import assert from 'node:assert/strict';
import { registerHooks } from 'node:module';

// Exercise the actual Edge handler with no network, real credentials, or DB writes.
const stub = `
export function getUserClient() { return {auth: {getUser: async () => globalThis.__cheffoTest.auth}}; }
export function getSupabaseAdmin() { return {
  from() { return {select() { return {eq() { return {async maybeSingle() {
    if (globalThis.__cheffoTest.subThrow) throw new Error('test subscription outage');
    return globalThis.__cheffoTest.subscription;
  }}}}}}; },
  async rpc() {
    globalThis.__cheffoTest.quotaCalls++;
    if (globalThis.__cheffoTest.quotaThrow) throw new Error('test quota outage');
    return globalThis.__cheffoTest.quota;
  }
}; }
`;
registerHooks({resolve(specifier, context, nextResolve) {
  if (specifier === './_lib/supabaseAdmin' && context.parentURL?.endsWith('/api/llm.ts'))
    return {url: 'data:text/javascript,' + encodeURIComponent(stub), shortCircuit: true};
  return nextResolve(specifier, context);
}});
process.env.LLM_API_KEY = 'test-only-not-a-key';
process.env.LLM_BASE_URL = 'https://unit-test.invalid';
const {default: handler} = await import('../api/llm.ts');
let upstreamCalls = 0;
globalThis.fetch = async () => { upstreamCalls++; return new Response('{"ok":true}'); };
async function check(name, changes, expectedStatus, image = false, authenticated = true) {
  globalThis.__cheffoTest = {
    auth: {data: {user: {id: 'unit-user'}}, error: null},
    subscription: {data: {status: 'active'}, error: null},
    quota: {data: [{allowed: true}], error: null}, quotaCalls: 0,
    ...changes,
  };
  upstreamCalls = 0;
  const response = await handler(new Request(`https://app.invalid/api/llm${image ? '?type=image' : ''}`, {
    method: 'POST', headers: authenticated ? {authorization: 'Bearer test-token'} : {}, body: changes.requestBody ?? '{}',
  }));
  assert.equal(response.status, expectedStatus, name);
  if (expectedStatus === 413) assert.equal(globalThis.__cheffoTest.quotaCalls, 0, 'oversized input must not consume quota');
  assert.equal(upstreamCalls, expectedStatus === 200 ? 1 : 0, `${name}: paid provider must not run when denied`);
}
await check('anonymous denied', {}, 401, false, false);
await check('invalid session denied', {auth: {data: {user: null}, error: new Error('invalid')}}, 401);
await check('free account denied', {subscription: {data: null, error: null}}, 403);
await check('subscription DB error fails closed', {subscription: {data: null, error: {message: 'test outage'}}}, 503);
await check('subscription exception fails closed', {subThrow: true}, 503);
await check('quota DB error fails closed', {quota: {data: null, error: {message: 'test outage'}}}, 503);
await check('quota exception fails closed', {quotaThrow: true}, 503);
await check('missing quota result fails closed', {quota: {data: null, error: null}}, 503);
await check('malformed quota result fails closed', {quota: {data: [{}], error: null}}, 503);
await check('exhausted quota denied', {quota: {data: [{allowed: false}], error: null}}, 429);
for (const status of ['active', 'trialing', 'past_due']) await check(`${status} entitlement accepted`, {subscription: {data: {status}, error: null}}, 200);
await check('expired campaign denied', {subscription: {data: {status: 'active', campaign_code: '3dayfree', campaign_trial_end: '2000-01-01'}, error: null}}, 403);
await check('valid campaign accepted', {subscription: {data: {status: 'trialing', campaign_code: '3dayfree', campaign_trial_end: '2100-01-01'}, error: null}}, 200);
await check('free image requests cannot bypass entitlement', {subscription: {data: null, error: null}}, 403, true);
await check('premium image generation accepted', {}, 200, true);
await check('image quota outage fails closed', {quotaThrow: true}, 503, true);
await check('oversized body does not consume quota', {requestBody: 'x'.repeat(300_001)}, 413);
console.log('LLM authorization verified: 19 auth, entitlement, outage and quota cases; denied requests never reach the paid provider.');
