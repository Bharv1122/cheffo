import assert from 'node:assert/strict';
import { registerHooks } from 'node:module';
const stub = `
export function getUserClient() { return {auth:{async getUser() { if(globalThis.__adult.throwAuth)throw Error('outage');return globalThis.__adult.auth; }}}; }
export function getSupabaseAdmin() { return {auth:{admin:{async updateUserById(id, update) {
 globalThis.__adult.writes.push({id,update});
 if(globalThis.__adult.throwUpdate)throw Error('outage');
 if(globalThis.__adult.updateError)return {data:null,error:Error('outage')};
 return {data:{user:{id,app_metadata:globalThis.__adult.emptyResult?{}:update.app_metadata}},error:null};
}}}}; }
`;
registerHooks({resolve(specifier,context,nextResolve){
 if(specifier==='../_lib/supabaseAdmin'&&context.parentURL?.endsWith('/api/account/confirm-adult.ts'))return {url:'data:text/javascript,'+encodeURIComponent(stub),shortCircuit:true};
 return nextResolve(specifier,context);
}});
const {default:handler}=await import('../api/account/confirm-adult.ts');
let count=0;
async function check(name,{body={adult_confirmed:true},token=true,method='POST',...changes}={},status=200,writes=0){
 globalThis.__adult={auth:{data:{user:{id:'current-account',app_metadata:{provider:'email',existing:'keep-me'},user_metadata:{name:'Keep name'}}},error:null},writes:[],...changes};
 const response=await handler(new Request('https://app.invalid/api/account/confirm-adult',{method,headers:token?{authorization:'Bearer synthetic-token'}:{},...(method==='POST'?{body:typeof body==='string'?body:JSON.stringify(body)}:{})}));
 assert.equal(response.status,status,name);assert.equal(globalThis.__adult.writes.length,writes,name);count++;
 return globalThis.__adult.writes[0];
}
await check('GET denied',{method:'GET'},405);
await check('anonymous denied',{token:false},401);
await check('expired session',{auth:{data:{user:null},error:Error('expired')}},401);
await check('auth outage',{throwAuth:true},503);
for(const body of [{},{adult_confirmed:false},{adult_confirmed:'true'},{app_metadata:{cheffo_adult_confirmed:true}},'invalid'])await check('explicit boolean required',{body},400);
await check('oversized body',{body:'x'.repeat(1025)},413);
await check('storage error',{updateError:true},503,1);
await check('storage exception',{throwUpdate:true},503,1);
await check('missing saved flag',{emptyResult:true},503,1);
const write=await check('authenticated acknowledgement ignores other target and metadata',{body:{adult_confirmed:true,user_id:'someone-else',app_metadata:{role:'admin'}}},200,1);
assert.equal(write.id,'current-account');assert.equal(write.update.app_metadata.existing,'keep-me');assert.equal(write.update.app_metadata.provider,'email');assert.equal(write.update.app_metadata.role,undefined);assert.equal(write.update.app_metadata.cheffo_adult_confirmed,true);assert.ok(Date.parse(write.update.app_metadata.cheffo_adult_confirmed_at));assert.equal(write.update.app_metadata.cheffo_adult_policy,'18-plus-v1');assert.deepEqual(Object.keys(write.update),['app_metadata']);
await check('already confirmed is idempotent',{auth:{data:{user:{id:'current-account',app_metadata:{cheffo_adult_confirmed:true}}},error:null}},200);
await check('user-editable metadata does not skip server recording',{auth:{data:{user:{id:'current-account',user_metadata:{cheffo_adult_confirmed:true}}},error:null}},200,1);
console.log(`Adult confirmation: ${count} cases passed; authenticated account only, explicit boolean, preserved metadata, idempotence and storage failures.`);
