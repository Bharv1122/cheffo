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

const anyBundle = readdirSync('dist/assets')
  .filter(name => name.endsWith('.js'))
  .map(name => readFileSync(join('dist/assets', name), 'utf8'))
  .join('\n');

for (const marker of required) {
  if (!anyBundle.includes(marker)) {
    throw new Error(`Built JavaScript assets are missing audit marker: ${marker}`);
  }
}

// Security guard (CHE-5): the LLM provider key and endpoint must never reach
// the client bundle — they now live only in the api/llm.ts server proxy. Fail
// the build if a Google API key pattern or the upstream endpoint reappears in
// any built asset.
const distText = `${distIndex}\n${anyBundle}`;
const securityViolations = [
  { label: 'a Google API key', re: /AIza[0-9A-Za-z_-]{35}/ },
  { label: 'the LLM endpoint (generativelanguage.googleapis.com)', re: /generativelanguage\.googleapis\.com/ },
];
for (const { label, re } of securityViolations) {
  if (re.test(distText)) {
    throw new Error(`Security: built client assets contain ${label} — the LLM key/endpoint must stay server-side (see CHE-5).`);
  }
}

console.log(`Audit bundle markers present in ${scriptPath}: ${required.join(', ')}`);
