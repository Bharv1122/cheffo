// Deploy-shape check for /api/mcp. Vercel's Node.js runtime does not bundle:
// it transpiles each .ts file on the import graph and runs the output as ESM
// (this package is "type": "module"). An extensionless relative import then
// fails at runtime with ERR_MODULE_NOT_FOUND, which is how the first preview
// deploy broke. This script does the same: transpile the graph file by file,
// then import the result with plain Node (no loader hooks) and serve
// initialize, tools/list and tools/call. No network is used.
import assert from 'node:assert/strict';
import { mkdirSync, readFileSync, rmSync, writeFileSync, existsSync } from 'node:fs';
import { dirname, join, relative, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import ts from 'typescript';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const out = join(root, 'node_modules/.tmp/mcp-deploy');
rmSync(out, { recursive: true, force: true });

const seen = new Set();
const queue = [join(root, 'api/mcp.ts')];
while (queue.length) {
  const file = queue.pop();
  if (seen.has(file)) continue;
  seen.add(file);
  const { outputText } = ts.transpileModule(readFileSync(file, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022, verbatimModuleSyntax: false },
    fileName: file,
  });
  // Type-only imports are erased above; everything left is loaded at runtime.
  for (const [, specifier] of outputText.matchAll(/(?:from|import)\s*\(?\s*['"](\.{1,2}\/[^'"]+)['"]/g)) {
    assert.match(specifier, /\.js$/, `${relative(root, file)} imports "${specifier}" without an explicit .js extension; Vercel's Node runtime can't resolve it`);
    const source = resolve(dirname(file), specifier.replace(/\.js$/, '.ts'));
    assert.ok(existsSync(source), `${relative(root, file)}: "${specifier}" has no matching .ts source`);
    queue.push(source);
  }
  const target = join(out, relative(root, file)).replace(/\.ts$/, '.js');
  mkdirSync(dirname(target), { recursive: true });
  writeFileSync(target, outputText);
}
writeFileSync(join(out, 'package.json'), '{"type":"module"}\n');

const quiet = { log: console.log, warn: console.warn, error: console.error };
console.log = console.warn = console.error = () => {};
let mod;
try {
  mod = await import(pathToFileURL(join(out, 'api/mcp.js')).href);
} finally {
  Object.assign(console, quiet);
}
assert.equal(typeof mod.POST, 'function', 'POST handler exported');
assert.equal(typeof mod.GET, 'function', 'GET handler exported');
assert.equal(mod.default, undefined, 'no default export: Vercel would treat it as a Node (req, res) handler');

const post = async body => {
  console.log = console.warn = console.error = () => {};
  try {
    const response = await mod.POST(new Request('https://x.test/api/mcp', {
      method: 'POST',
      headers: { 'content-type': 'application/json', accept: 'application/json, text/event-stream' },
      body: JSON.stringify(body),
    }));
    return response.json();
  } finally {
    Object.assign(console, quiet);
  }
};
const init = await post({ jsonrpc: '2.0', id: 1, method: 'initialize', params: { protocolVersion: '2025-06-18', capabilities: {}, clientInfo: { name: 'deploy-check', version: '1' } } });
assert.equal(init.result?.serverInfo?.name, 'cheffo-doggo');
const list = await post({ jsonrpc: '2.0', id: 2, method: 'tools/list', params: {} });
assert.equal(list.result.tools.length, 3);
const call = await post({ jsonrpc: '2.0', id: 3, method: 'tools/call', params: { name: 'treat_idea', arguments: { category: 'birthday' } } });
assert.match(call.result.content[0].text, /^Treat idea:/);
assert.equal(mod.GET().status, 405);
rmSync(out, { recursive: true, force: true });
console.log(`MCP deploy shape verified: ${seen.size} files transpiled individually and served by plain Node ESM.`);
