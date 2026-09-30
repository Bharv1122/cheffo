// Bundle api/mcp.ts for the Edge runtime and run it inside Vercel's own
// edge-runtime sandbox (no Node APIs; `eval` / `new Function` throw). Catches
// what the Node-based verify-mcp-tools.mjs can't: imports that don't bundle,
// Node-only APIs, and code generation such as ajv's. No network is used.
import assert from 'node:assert/strict';
import { rolldown } from 'rolldown';
import { EdgeRuntime } from 'edge-runtime';

const bundle = await rolldown({
  input: new URL('../api/mcp.ts', import.meta.url).pathname,
  platform: 'browser',
  resolve: { conditionNames: ['edge-light', 'worker', 'browser', 'import', 'default'] },
  logLevel: 'silent',
});
const { output } = await bundle.generate({ format: 'iife', name: '__mcp', exports: 'named', codeSplitting: false });
await bundle.close();
const code = output[0].code;
assert.ok(code.length > 1000, 'bundle produced');

const runtime = new EdgeRuntime({ extend: context => Object.assign(context, { process: { env: {} }, console: { log() {}, info() {}, warn() {}, error() {} } }) });
runtime.evaluate(code);
const post = async body => JSON.parse(await runtime.evaluate(`__mcp.default(new Request('https://x.test/api/mcp', {method: 'POST',
  headers: {'content-type': 'application/json', accept: 'application/json, text/event-stream', 'x-forwarded-for': '198.51.100.7'},
  body: ${JSON.stringify(JSON.stringify(body))}})).then(r => r.text())`));

const init = await post({ jsonrpc: '2.0', id: 1, method: 'initialize', params: { protocolVersion: '2025-06-18', capabilities: {}, clientInfo: { name: 'edge-check', version: '1' } } });
assert.equal(init.result?.serverInfo?.name, 'cheffo-doggo', `initialize failed: ${JSON.stringify(init).slice(0, 300)}`);
const list = await post({ jsonrpc: '2.0', id: 2, method: 'tools/list', params: {} });
assert.deepEqual(list.result.tools.map(t => t.name).sort(), ['check_food_safety', 'daily_calorie_estimate', 'treat_idea']);
const call = await post({ jsonrpc: '2.0', id: 3, method: 'tools/call', params: { name: 'check_food_safety', arguments: { food: 'grapes' } } });
assert.match(call.result.content[0].text, /^Do not feed/);
const bad = await post({ jsonrpc: '2.0', id: 4, method: 'tools/call', params: { name: 'daily_calorie_estimate', arguments: { weight: -1, life_stage: 'adult' } } });
assert.equal(bad.result?.isError ?? !!bad.error, true, 'invalid input rejected on edge');
const get = await runtime.evaluate(`__mcp.default(new Request('https://x.test/api/mcp')).then(r => r.status)`);
assert.equal(get, 405);
console.log(`MCP edge bundle verified: ${(code.length / 1024).toFixed(0)} KiB, initialize/tools/list/tools/call run in the edge-runtime sandbox.`);
