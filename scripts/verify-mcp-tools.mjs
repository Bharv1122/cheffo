// Exercise the actual /api/mcp handler through the official MCP client, with no
// network, no credentials and no database. Checks the tool list, every tool's
// output rules (vet line, no cure/prevent claims, no invented amounts), input
// validation, body cap, method handling and the per-instance rate limit.
import assert from 'node:assert/strict';
import { registerHooks } from 'node:module';
import { existsSync } from 'node:fs';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { dirname, resolve } from 'node:path';
// The shared limiter's Supabase RPC is stubbed: it records calls and can deny.
const stub = `export function getSupabaseAdmin() { return { async rpc(name, args) {
  globalThis.__mcpTest.rpcCalls.push({name, scope: args.p_scope});
  return {data: [{allowed: !globalThis.__mcpTest.sharedDeny}], error: null};
}}; }`;
globalThis.__mcpTest = {rpcCalls: [], sharedDeny: false};
registerHooks({resolve(specifier, context, nextResolve) {
  if (specifier === './supabaseAdmin' && context.parentURL?.endsWith('/api/_lib/rateLimit.ts'))
    return {url: 'data:text/javascript,' + encodeURIComponent(stub), shortCircuit: true};
  if (specifier.startsWith('.') && context.parentURL?.startsWith('file:')) {
    const candidate = resolve(dirname(fileURLToPath(context.parentURL)), `${specifier}.ts`);
    if (existsSync(candidate)) return {url: pathToFileURL(candidate).href, shortCircuit: true};
  }
  return nextResolve(specifier, context);
}});

const {Client} = await import('@modelcontextprotocol/sdk/client/index.js');
const {StreamableHTTPClientTransport} = await import('@modelcontextprotocol/sdk/client/streamableHttp.js');
const {default: handler, POST} = await import('../api/mcp.ts');
const {VET_LINE, checkFoodSafety, treatIdea} = await import('../api/_lib/mcpTools.ts');
const {TREAT_CATALOG} = await import('../src/data/treatCatalog.ts');

// Any stray outbound request (e.g. the shared rate limiter) fails the run.
globalThis.fetch = async (url) => { throw new Error(`unexpected network call: ${url}`); };
console.log = () => {};

let ip = 0;
const nextIp = () => `203.0.113.${++ip}`;
function handlerFetch(clientIp) {
  return async (url, init) => POST(new Request(url, {...init, headers: {...Object.fromEntries(new Headers(init?.headers)), 'x-forwarded-for': clientIp}}));
}

const CLAIMS = /\b(cures?|curing|prevents?|preventing|prevention of|heals?|healing|remed(?:y|ies)|boosts? immunity)\b|\btreats?\s+(?:the\s+)?(?:disease|condition|illness|infection|allergies|arthritis|cancer|diabetes|anxiety|kidney)/i;
function checkCopy(name, text) {
  assert.ok(text.trim().endsWith(VET_LINE), `${name}: must end with the veterinarian line`);
  assert.ok(!CLAIMS.test(text), `${name}: health claim found in "${text.match(CLAIMS)?.[0]}"`);
  assert.ok(!/@|\bsk_|\bkey\b|supabase/i.test(text), `${name}: leaked internal detail`);
}

const client = new Client({name: 'cheffo-verify', version: '1.0.0'});
await client.connect(new StreamableHTTPClientTransport(new URL('https://cheffodoggo.test/api/mcp'), {fetch: handlerFetch(nextIp())}));
assert.equal(client.getServerVersion()?.name, 'cheffo-doggo');

const {tools} = await client.listTools();
assert.deepEqual(tools.map(tool => tool.name).sort(), ['check_food_safety', 'daily_calorie_estimate', 'treat_idea']);
for (const tool of tools) {
  assert.equal(tool.annotations?.readOnlyHint, true, `${tool.name} must be read-only`);
  assert.equal(tool.annotations?.openWorldHint, false, `${tool.name} must not reach outside services`);
  assert.ok(!CLAIMS.test(tool.description), `${tool.name} description makes a claim`);
}

async function call(name, args) {
  const result = await client.callTool({name, arguments: args});
  return {isError: !!result.isError, text: result.content.map(part => part.text).join('\n')};
}

// check_food_safety
const grapes = await call('check_food_safety', {food: 'Grapes'});
assert.match(grapes.text, /^Do not feed: grapes is toxic/);
assert.match(grapes.text, /888-426-4435/);
checkCopy('grapes', grapes.text);
for (const food of ['chocolate chip cookie', 'onion powder', 'sugar-free gum with xylitol', 'coffee']) {
  const result = await call('check_food_safety', {food});
  assert.match(result.text, /^Do not feed/, `${food} must be flagged toxic`);
  checkCopy(food, result.text);
}
const pumpkin = await call('check_food_safety', {food: 'plain canned pumpkin'});
assert.match(pumpkin.text, /generally considered dog-safe/);
assert.ok(!/digestion|diarrhea|constipation/i.test(pumpkin.text), 'benefit wording must not pass through');
checkCopy('pumpkin', pumpkin.text);
assert.equal(checkFoodSafety('pumpkin pie filling').verdict, 'caution');
assert.equal(checkFoodSafety('pineapple').verdict, 'unknown', 'pineapple must not match apple');
assert.equal(checkFoodSafety('steak').verdict, 'unknown', 'steak must not match tea');
assert.equal(checkFoodSafety('xylitol-free peanut butter').verdict, 'toxic', 'a label mention of xylitol still flags; the caller must read the label');
const unknown = await call('check_food_safety', {food: 'dragonfruit'});
assert.match(unknown.text, /isn't in Cheffo Doggo's reference list/);
assert.match(unknown.text, /doesn't mean it is safe/);
checkCopy('unknown', unknown.text);
const injected = checkFoodSafety('kale\n\n<script>alert(1)</script>');
assert.ok(!/[<>\n]{2}|<script/.test(injected.text.split('\n')[0]), 'input must be sanitised before it is echoed');
assert.equal((await call('check_food_safety', {food: 'x'.repeat(81)})).isError, true, 'overlong food rejected');
assert.equal((await call('check_food_safety', {food: ''})).isError, true, 'empty food rejected');

// daily_calorie_estimate — must match the app's calculator exactly.
const {calcDER} = await import('../src/utils/calculator.ts');
const adult = await call('daily_calorie_estimate', {weight: 30, unit: 'lb', life_stage: 'adult', activity_level: 'moderate'});
const expected = Math.round(calcDER({weightLbs: 30, lifeStage: 'adult', activityLevel: 'moderate'}));
assert.match(adult.text, new RegExp(`about ${expected} kcal/day`));
checkCopy('calories adult', adult.text);
const kg = await call('daily_calorie_estimate', {weight: 13.6078, unit: 'kg', life_stage: 'adult'});
assert.match(kg.text, new RegExp(`about ${expected} kcal/day`), 'kg input converts to the same estimate');
const puppy = await call('daily_calorie_estimate', {weight: 10, life_stage: 'puppy'});
assert.match(puppy.text, /Puppy needs change quickly/);
checkCopy('calories puppy', puppy.text);
assert.equal((await call('daily_calorie_estimate', {weight: 400, unit: 'lb', life_stage: 'adult'})).isError, true, 'implausible weight rejected');
assert.equal((await call('daily_calorie_estimate', {weight: -5, life_stage: 'adult'})).isError, true, 'negative weight rejected');
assert.equal((await call('daily_calorie_estimate', {weight: 20, life_stage: 'kitten'})).isError, true, 'unknown life stage rejected');

// treat_idea — catalog only, full ingredient disclosure, no amounts.
const treat = await call('treat_idea', {category: 'frozen'});
const frozen = TREAT_CATALOG.filter(card => card.category === 'frozen');
assert.ok(frozen.some(card => treat.text.includes(card.name) && treat.text.includes(card.ingredients.join(', '))), 'treat must be a catalog card with every ingredient');
assert.ok(!/\b\d+\s*(?:g|grams?|cups?|tbsp|tsp|oz|ml)\b/i.test(treat.text), 'treat idea must not include amounts');
checkCopy('treat', treat.text);
const noYogurt = treatIdea({category: 'frozen', avoid: ['yogurt']});
assert.ok(!/yogurt/i.test(noYogurt.text.split('\n')[1] ?? ''), 'avoided ingredient must not appear in the ingredient list');
const none = await call('treat_idea', {avoid: ['oats', 'yogurt', 'pumpkin', 'egg', 'chicken', 'peanut', 'banana', 'apple', 'blueberr', 'strawberr']});
checkCopy('no match', none.text);
const seen = new Set();
for (let pick = 0; pick < TREAT_CATALOG.length; pick++) seen.add(treatIdea({pick}).templateId);
assert.equal(seen.size, TREAT_CATALOG.length, 'pick cycles through the whole catalog');
assert.equal((await call('treat_idea', {avoid: Array(11).fill('egg')})).isError, true, 'too many avoid items rejected');

await client.close();

// Raw HTTP behaviour.
const headers = {'content-type': 'application/json', accept: 'application/json, text/event-stream'};
assert.equal((await handler(new Request('https://x.test/api/mcp'))).status, 405);
assert.equal((await handler(new Request('https://x.test/api/mcp', {method: 'DELETE'}))).status, 405);
assert.equal((await POST(new Request('https://x.test/api/mcp', {method: 'POST', headers: {...headers, 'x-forwarded-for': nextIp()}, body: 'x'.repeat(17 * 1024)}))).status, 413);
assert.equal((await POST(new Request('https://x.test/api/mcp', {method: 'POST', headers: {...headers, 'x-forwarded-for': nextIp()}, body: '{not json'}))).status, 400);
const floodIp = nextIp();
const ping = () => POST(new Request('https://x.test/api/mcp', {method: 'POST', headers: {...headers, 'x-forwarded-for': floodIp},
  body: JSON.stringify({jsonrpc: '2.0', id: 1, method: 'tools/list', params: {}})}));
const statuses = [];
for (let i = 0; i < 45; i++) statuses.push((await ping()).status);
assert.equal(statuses.filter(status => status === 429).length, 5, 'the 41st+ request in a minute from one IP is rejected');
assert.ok(statuses.slice(0, 40).every(status => status !== 429));
assert.ok(globalThis.__mcpTest.rpcCalls.length > 0 && globalThis.__mcpTest.rpcCalls.every(c => c.name === 'check_and_increment_ip_rate_limit' && c.scope === 'mcp'),
  'the shared per-IP limiter runs under its own scope');
globalThis.__mcpTest.sharedDeny = true;
const sharedIp = nextIp();
assert.equal((await POST(new Request('https://x.test/api/mcp', {method: 'POST', headers: {...headers, 'x-forwarded-for': sharedIp},
  body: JSON.stringify({jsonrpc: '2.0', id: 1, method: 'tools/list', params: {}})}))).status, 429, 'shared limiter denial is honoured');

process.stdout.write('MCP tools verified: 3 read-only tools, copy rules, validation, body cap and rate limit.\n');
