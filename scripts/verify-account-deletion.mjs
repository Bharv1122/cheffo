import assert from 'node:assert/strict';
import { registerHooks } from 'node:module';

// Actual handler, fully mocked providers. No real account or network is touched.
const stub = `
function client(admin) { return {
 auth: admin ? {admin: {async deleteUser(id) {const t=globalThis.__deleteTest; t.events.push('auth:'+id); return {error:t.authDeleteError ?? null};}}} : {getUser: async()=>globalThis.__deleteTest.auth},
 from(table) { return {
  select() {return {eq(){return {async maybeSingle(){const t=globalThis.__deleteTest;t.events.push('lookup');if(t.lookupThrows)throw Error('lookup outage');return t.subscription;}}}}},
  delete() {return {async eq(key,id){const t=globalThis.__deleteTest;t.events.push('delete:'+table+':'+id);return {error:t.deleteErrorTable===table?{message:'test database outage'}:null};}}}
 } }
}; }
export function getUserClient(){return client(false)}
export function getSupabaseAdmin(){return client(true)}
`;
registerHooks({resolve(specifier, context, nextResolve) {
  if (specifier === '../_lib/supabaseAdmin' && context.parentURL?.endsWith('/api/account/delete.ts'))
    return {url:'data:text/javascript,'+encodeURIComponent(stub),shortCircuit:true};
  return nextResolve(specifier,context);
}});
const {default: handler}=await import('../api/account/delete.ts');
globalThis.fetch=async(url,options)=>{
  const t=globalThis.__deleteTest;
  assert.equal(url,'https://api.stripe.com/v1/subscriptions/sub_synthetic');
  assert.equal(options.method,'DELETE');
  t.events.push('stripe:cancel');
  if(t.cancelThrows)throw Error('test Stripe outage');
  return new Response('{}',{status:t.cancelStatus??200});
};
let checks=0;
async function check(name, changes, expectedStatus, expectedEffect) {
  globalThis.__deleteTest={
    events:[],auth:{data:{user:{id:'synthetic-user',email:'fixture@example.invalid'}},error:null},
    subscription:{data:{stripe_subscription_id:'sub_synthetic',status:'active'},error:null},...changes,
  };
  process.env.STRIPE_SECRET_KEY=changes.missingKey?'':'synthetic-test-value';
  const response=await handler(new Request('https://app.invalid/api/account/delete',{
    method:'POST',headers:changes.anonymous?{}:{authorization:'Bearer test-token'},
    body:JSON.stringify({confirm:changes.confirm??'fixture@example.invalid'}),
  }));
  const events=globalThis.__deleteTest.events;
  assert.equal(response.status,expectedStatus,name);
  if(changes.deleteErrorTable) { const body=await response.json(); assert.equal(body.details,undefined,'raw database details must stay server-side'); assert.ok(!JSON.stringify(body).includes('test database outage')); }
  if(expectedEffect==='none') assert.equal(events.filter(x=>x.startsWith('delete:')||x.startsWith('auth:')).length,0,name);
  if(expectedEffect==='no-stripe') assert.ok(!events.includes('stripe:cancel'),name);
  if(expectedStatus===200){
    assert.equal(events.filter(x=>x.startsWith('delete:')).length,6,name);
    assert.equal(events.at(-1),'auth:synthetic-user',name);
    if(events.includes('stripe:cancel')) assert.ok(events.indexOf('stripe:cancel')<events.findIndex(x=>x.startsWith('delete:')),name);
  }
  if(changes.deleteErrorTable||changes.authDeleteError) assert.equal(events.filter(x=>x.startsWith('auth:')).length,changes.authDeleteError?1:0,name);
  checks++;
}
await check('anonymous rejected',{anonymous:true},401,'none');
await check('confirmation mismatch',{confirm:'wrong@example.invalid'},400,'none');
await check('invalid session',{auth:{data:{user:null},error:{message:'expired'}}},401,'none');
await check('subscription lookup error stops erasure',{subscription:{data:null,error:{message:'outage'}}},503,'none');
await check('subscription lookup exception stops erasure',{lookupThrows:true},503,'none');
await check('missing cancellation credentials stops erasure',{missingKey:true},500,'none');
await check('Stripe cancellation failure stops erasure',{cancelStatus:500},502,'none');
await check('Stripe cancellation network error stops erasure',{cancelThrows:true},502,'none');
for(const status of ['active','trialing','past_due','unpaid','paused','incomplete'])
  await check(`${status} cancelled before all erasure`,{subscription:{data:{stripe_subscription_id:'sub_synthetic',status},error:null}},200);
await check('already missing Stripe subscription',{cancelStatus:404},200);
await check('free account deletion',{subscription:{data:null,error:null}},200,'no-stripe');
await check('cancelled subscription needs no new cancellation',{subscription:{data:{stripe_subscription_id:'sub_synthetic',status:'canceled'},error:null}},200,'no-stripe');
for(const table of ['saved_recipes','llm_usage','subscriptions']) await check(`${table} deletion error preserves login`,{deleteErrorTable:table},500);
await check('auth deletion error reported',{authDeleteError:{message:'test auth outage'}},500);
console.log(`Account deletion verified: ${checks} synthetic auth, lookup, cancellation, ordering and erasure cases. No real account or payment was touched.`);
