// Post-build guard: three.js, @react-three/* and the XR runtime must only load
// on the /kitchen/:id/xr route. Walks the entry chunk's static import graph in
// dist/ and fails if any of it contains three.js / WebXR runtime code.
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { gzipSync } from 'node:zlib';

const dist = new URL('../dist/', import.meta.url).pathname;
const html = readFileSync(join(dist, 'index.html'), 'utf8');
const entry = html.match(/src="\/(assets\/index-[^"]+\.js)"/)?.[1];
assert.ok(entry, 'entry chunk not found in dist/index.html');

const initial = new Set();
const queue = [entry];
while (queue.length) {
  const file = queue.pop();
  if (initial.has(file)) continue;
  initial.add(file);
  const source = readFileSync(join(dist, file), 'utf8');
  for (const match of source.matchAll(/import\s*(?:[\w${},\s*]*?from\s*)?["']\.\/([^"']+\.js)["']/g)) queue.push(`assets/${match[1]}`);
}

// Strings that only exist inside three.js / @react-three/xr builds.
const XR_MARKERS = ['WebGLRenderer', 'immersive-ar', 'XRWebGLLayer', 'createXRStore'];
let bytes = 0;
let gzip = 0;
for (const file of initial) {
  const buffer = readFileSync(join(dist, file));
  bytes += buffer.length;
  gzip += gzipSync(buffer).length;
  const text = buffer.toString('utf8');
  for (const marker of XR_MARKERS) assert.ok(!text.includes(marker), `${file} (initial load) contains XR code: ${marker}`);
}
const xrChunk = readdirSync(join(dist, 'assets')).find(name => /^KitchenXR-.*\.js$/.test(name));
assert.ok(xrChunk, 'the KitchenXR route chunk must exist');
assert.ok(!initial.has(`assets/${xrChunk}`), 'KitchenXR must not be in the initial load');
console.log(`XR lazy-load verified: ${initial.size} initial chunks, ${(bytes / 1024).toFixed(1)} KiB (${(gzip / 1024).toFixed(1)} KiB gzip), no three.js/WebXR code.`);
