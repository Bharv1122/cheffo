import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

const distIndex = readFileSync('dist/index.html', 'utf8');
const scriptMatch = distIndex.match(/<script[^>]+src=["']([^"']+\.js)["']/i);

if (!scriptMatch) {
  throw new Error('Could not find the root-linked main JavaScript bundle in dist/index.html');
}

const scriptPath = scriptMatch[1].replace(/^\//, '');
const bundlePath = join('dist', scriptPath);
const bundle = readFileSync(bundlePath, 'utf8');
const required = ['Trash2', 'aria-pressed', 'hasIngredientsSection'];
const missing = required.filter(marker => !bundle.includes(marker));

if (missing.length > 0) {
  throw new Error(`Root-linked bundle ${scriptPath} is missing audit marker(s): ${missing.join(', ')}`);
}

const assetFiles = readdirSync('dist/assets')
  .filter(name => name.endsWith('.js'))
  .map(name => ({ name, text: readFileSync(join('dist/assets', name), 'utf8') }));
const anyBundle = assetFiles.map(file => file.text).join('\n');

for (const marker of required) {
  if (!anyBundle.includes(marker)) {
    throw new Error(`Built JavaScript assets are missing audit marker: ${marker}`);
  }
}

// Security guard (CHE-5): the LLM provider key and endpoint must never reach
// the client bundle — they now live only in the api/llm.ts server proxy. Fail
// the build if a Google API key pattern or the upstream endpoint reappears in
// any built asset.
//
// One narrow exception for the endpoint host: the Voice Lab lazily loads
// Google's own Live SDK, which must open a browser WebSocket to Google using a
// short-lived, server-constrained token (api/voice/session.ts). That SDK chunk
// is identified by its own user-agent marker and must not be the root bundle.
// Keys stay forbidden everywhere, including in that chunk.
const LIVE_SDK_MARKER = 'google-genai-sdk/';
const isLiveSdkChunk = file => file.text.includes(LIVE_SDK_MARKER) && `assets/${file.name}` !== scriptPath;
const securityViolations = [
  { label: 'a Google API key', re: /AIza[0-9A-Za-z_-]{35}/, files: assetFiles },
  { label: 'the LLM endpoint (generativelanguage.googleapis.com)', re: /generativelanguage\.googleapis\.com/, files: assetFiles.filter(file => !isLiveSdkChunk(file)) },
];
for (const { label, re, files } of securityViolations) {
  const hit = [{ name: 'index.html', text: distIndex }, ...files].find(file => re.test(file.text));
  if (hit) {
    throw new Error(`Security: built client asset ${hit.name} contains ${label} — the LLM key/endpoint must stay server-side (see CHE-5).`);
  }
}
if (bundle.includes(LIVE_SDK_MARKER)) {
  throw new Error('Security: the Live SDK must stay a lazily loaded chunk, not part of the root bundle.');
}

console.log(`Audit bundle markers present in ${scriptPath}: ${required.join(', ')}`);
