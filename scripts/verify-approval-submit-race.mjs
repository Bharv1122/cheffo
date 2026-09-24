import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { existsSync } from 'node:fs';
import { registerHooks } from 'node:module';
import { dirname, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

// Runs the actual handler. Only Supabase, rate limiting, and outgoing mail are
// mocked. Tokens, validation, ingredient normalization, and recipe math remain
// real. The fake database evaluates every supplied WHERE predicate atomically.
// This exercises application behavior, not live Postgres concurrency/RLS.
const root = dirname(fileURLToPath(import.meta.url));
const repo = resolve(process.env.CHEFFO_REPO ?? resolve(root, '..'));
const handlerPath = resolve(process.env.CHEFFO_APPROVAL_HANDLER ?? resolve(repo, 'api/approvals/submit.ts'));
const handlerURL = pathToFileURL(handlerPath).href;
const repoHandlerURL = pathToFileURL(resolve(repo, 'api/approvals/submit.ts')).href;
const stub = `
export function getSupabaseAdmin() { return globalThis.__approvalRace.admin; }
export async function checkIpRateLimit() { return { allowed: true }; }
export function tooManyRequestsResponse() { return new Response('{}', {status: 429}); }
`;
registerHooks({
  resolve(specifier, context, nextResolve) {
    if (context.parentURL === handlerURL) {
      if (specifier === '../_lib/supabaseAdmin' || specifier === '../_lib/rateLimit') {
        return { url: 'data:text/javascript,' + encodeURIComponent(stub), shortCircuit: true };
      }
      if (specifier.startsWith('.')) context = { ...context, parentURL: repoHandlerURL };
    }
    try {
      return nextResolve(specifier, context);
    } catch (error) {
      if (!specifier.startsWith('.') || !context.parentURL?.startsWith('file:')) throw error;
      const candidate = new URL(specifier + '.ts', context.parentURL);
      if (!existsSync(fileURLToPath(candidate))) throw error;
      return nextResolve(candidate.href, context);
    }
  },
});

const { default: handler } = await import(handlerURL);
const token = 'synthetic-token-for-approval-race-tests';
const tokenHash = createHash('sha256').update(token).digest('hex');
const approvalId = '11111111-1111-4111-8111-111111111111';
const recipeId = '22222222-2222-4222-8222-222222222222';
const dogId = '33333333-3333-4333-8333-333333333333';
const results = [];

function deferred() {
  let release;
  const promise = new Promise(resolve => { release = resolve; });
  return { promise, release };
}

function state(options = {}) {
  const readsReady = deferred();
  const winnerApplied = deferred();
  const s = {
    row: {
      id: approvalId, recipe_id: recipeId, dog_profile_id: dogId,
      user_id: 'synthetic-owner', token_hash: tokenHash,
      token_expires_at: '2099-01-01T00:00:00.000Z', status: 'pending',
      recipe_snapshot: { name: 'Synthetic test recipe' },
    },
    dog: { id: dogId, name: 'Synthetic dog', allergies: [], avoid_foods: [], medications: [], life_stage: 'adult' },
    recipe: {
      id: recipeId,
      recipe_data: {
        name: 'Synthetic test recipe', ingredients: [],
        serving: { mealsPerDay: 2 }, shoppingList: [{ name: 'Bowl', category: 'equipment' }],
      },
    },
    lookupCount: 0, approvalWrites: [], recipeWrites: [], notifications: [], events: [],
    ...options,
  };

  class Query {
    constructor(table) { this.table = table; this.filters = []; }
    select(columns) { this.projection = columns; this.operation ??= 'select'; return this; }
    update(values) { this.operation = 'update'; this.values = structuredClone(values); return this; }
    eq(key, value) { this.filters.push([key, value]); return this; }
    single() { return this.execute(); }
    maybeSingle() { return this.execute(); }
    then(onFulfilled, onRejected) { return this.execute().then(onFulfilled, onRejected); }
    execute() { this.promise ??= this.run(); return this.promise; }
    matches(row) { return row && this.filters.every(([key, value]) => row[key] === value); }
    async run() {
      if (this.operation === 'select') {
        const row = this.table === 'approvals' ? s.row : this.table === 'saved_recipes' ? s.recipe : s.dog;
        const snapshot = this.matches(row) ? structuredClone(row) : null;
        if (this.table === 'approvals') {
          s.lookupCount++;
          // Both contenders must observe pending before either can claim it.
          if (s.concurrentReads) {
            if (s.lookupCount === s.concurrentReads) readsReady.release();
            await readsReady.promise;
          }
        }
        return { data: snapshot, error: null };
      }
      if (this.table === 'approvals') {
        if (s.forceWinner && this.values.vet_name !== s.forceWinner) await winnerApplied.promise;
        try {
          if (s.beforeClaim) { const change = s.beforeClaim; s.beforeClaim = null; change(s); }
          if (s.claimError) return { data: null, error: { message: 'Synthetic database outage' } };
          if (!this.matches(s.row)) return { data: null, error: null };
          Object.assign(s.row, this.values);
          s.approvalWrites.push(structuredClone(this.values));
          s.events.push('approval:' + this.values.vet_name);
          return { data: this.projection ? { id: s.row.id } : null, error: null };
        } finally {
          if (!s.forceWinner || this.values.vet_name === s.forceWinner) winnerApplied.release();
        }
      }
      assert.equal(this.table, 'saved_recipes', 'unexpected mutation target');
      if (!this.matches(s.recipe)) return { data: null, error: null };
      Object.assign(s.recipe, this.values);
      s.recipeWrites.push(structuredClone(this.values));
      s.events.push('recipe');
      return { data: null, error: null };
    }
  }
  s.admin = {
    from(table) {
      assert.ok(['approvals', 'saved_recipes', 'dog_profiles'].includes(table));
      return new Query(table);
    },
    auth: { admin: { async getUserById(id) {
      assert.equal(id, 'synthetic-owner');
      s.events.push('notification-lookup');
      return { data: { user: { email: 'fixture@example.invalid' } }, error: null };
    } } },
  };
  globalThis.__approvalRace = s;
  return s;
}

process.env.RESEND_API_KEY = 'synthetic-test-key';
process.env.PUBLIC_APP_ORIGIN = 'https://app.invalid';
globalThis.fetch = async (url, options) => {
  assert.equal(url, 'https://api.resend.com/emails', 'unexpected network target');
  assert.equal(options.method, 'POST');
  const message = JSON.parse(options.body);
  assert.deepEqual(message.to, ['fixture@example.invalid']);
  const s = globalThis.__approvalRace;
  s.notifications.push(message);
  s.events.push('notification');
  return new Response('{}', { status: 200 });
};

function request(overrides = {}) {
  return new Request('https://app.invalid/api/approvals/submit', {
    method: 'POST', headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ token, decision: 'approve', vetName: 'Alpha', signatureConfirmed: true, ...overrides }),
  });
}

const edits = amountGrams => [{ name: 'Chicken', amountGrams, category: 'protein' }];
function assertNoEffects(s) {
  assert.equal(s.approvalWrites.length, 0);
  assert.equal(s.recipeWrites.length, 0);
  assert.equal(s.notifications.length, 0);
  assert.equal(s.events.includes('notification-lookup'), false);
}

async function race(name, first, second, winner, expectedStatus, expectedAmount) {
  const s = state({ concurrentReads: 2, forceWinner: winner });
  const responses = await Promise.all([handler(request(first)), handler(request(second))]);
  assert.deepEqual(responses.map(r => r.status).sort(), [200, 409], name);
  assert.equal(s.lookupCount, 2, 'both read the pending snapshot');
  assert.equal(s.approvalWrites.length, 1, 'one durable approval decision');
  assert.equal(s.row.status, expectedStatus, 'winner decision survives');
  assert.equal(s.row.vet_name, winner, 'winner identity survives');
  assert.equal(s.recipeWrites.length, expectedAmount === null ? 0 : 1, 'only winner can edit recipe');
  if (expectedAmount !== null) {
    assert.equal(s.recipe.recipe_data.ingredients[0].amountGrams, expectedAmount);
    assert.ok(s.events.indexOf('approval:' + winner) < s.events.indexOf('recipe'));
  }
  assert.equal(s.notifications.length, 1, 'one notification');
  assert.ok(s.notifications[0].subject.includes('Dr. ' + winner));
  const loserBody = await responses.find(r => r.status === 409).json();
  assert.equal(typeof loserBody.error, 'string');
  results.push(name);
}

await race('two pending readers cannot overwrite the winning decision or ingredients',
  { vetName: 'Alpha', ingredientEdits: edits(60) },
  { vetName: 'Beta', decision: 'approve_with_notes', notes: 'Different decision', ingredientEdits: edits(120) },
  'Alpha', 'approved', 60);
await race('winning decline blocks the losing approval ingredient edits',
  { vetName: 'Alpha', ingredientEdits: edits(60) },
  { vetName: 'Beta', decision: 'decline', ingredientEdits: edits(120) },
  'Beta', 'declined', null);
await race('winning approval cannot be overwritten by concurrent decline',
  { vetName: 'Alpha', ingredientEdits: edits(60) },
  { vetName: 'Beta', decision: 'decline' },
  'Alpha', 'approved', 60);

for (const [name, beforeClaim] of [
  ['approval deleted after lookup fails closed', s => { s.row = null; }],
  ['decision changes after lookup fails closed', s => { s.row.status = 'declined'; s.row.vet_name = 'Earlier reviewer'; }],
]) {
  const s = state({ beforeClaim });
  const response = await handler(request({ ingredientEdits: edits(60) }));
  assert.equal(response.status, 409, name);
  assertNoEffects(s);
  results.push(name);
}

{
  const s = state({ claimError: true });
  assert.equal((await handler(request({ ingredientEdits: edits(60) }))).status, 500);
  assertNoEffects(s);
  results.push('database claim error cannot mutate recipe or notify');
}
{
  const s = state();
  s.row.status = 'approved';
  assert.equal((await handler(request())).status, 409);
  assertNoEffects(s);
  results.push('already submitted token is still rejected');
}
{
  const s = state();
  s.row.token_expires_at = '2000-01-01T00:00:00.000Z';
  assert.equal((await handler(request())).status, 410);
  assertNoEffects(s);
  results.push('expired token is still rejected');
}
{
  const s = state();
  const response = await handler(request());
  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), { status: 'approved' });
  assert.equal(s.approvalWrites.length, 1);
  assert.equal(s.recipeWrites.length, 0);
  assert.equal(s.notifications.length, 1);
  assert.equal(response.headers.get('cache-control'), 'no-store');
  results.push('normal approval response and notification are preserved');
}
{
  const s = state();
  const response = await handler(request({ decision: 'decline', ingredientEdits: edits(60) }));
  assert.equal(response.status, 200);
  assert.equal(s.row.status, 'declined');
  assert.equal(s.recipeWrites.length, 0);
  assert.equal(s.notifications.length, 1);
  results.push('normal decline continues to ignore ingredient edits');
}
{
  const s = state();
  assert.equal((await handler(request({ decision: 'approve_with_notes' }))).status, 400);
  assertNoEffects(s);
  results.push('required notes validation is preserved');
}

console.log(JSON.stringify({
  passed: results.length, cases: results, handlerPath,
  networkRequests: 0, databaseMutations: 0,
  limitation: 'Synthetic atomic database model tests handler behavior; no live Postgres or RLS test.',
}, null, 2));
