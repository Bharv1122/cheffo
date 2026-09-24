import assert from 'node:assert/strict';
import { registerHooks } from 'node:module';
const recipeId = '11111111-1111-4111-8111-111111111111';
const reportId = '22222222-2222-4222-8222-222222222222';
const stub = `
export function getUserClient() { return {auth:{async getUser(){ if(globalThis.__reports.authThrows)throw Error('auth outage');return globalThis.__reports.auth; }}}; }
export function getSupabaseAdmin() { return {
 async rpc(name,args){const s=globalThis.__reports;s.rpcCalls.push({name,args});if(s.rpcThrows)throw Error('insert outage');if(s.concurrent){if(s.count>=10)return {data:null,error:null};s.count++;}else if(s.rpc.error||!s.rpc.data||typeof s.rpc.data!=='string'||!s.rpc.data.includes('-'))return s.rpc;s.writes.push(args);return s.rpc;},
 from(table){const s=globalThis.__reports;if(table!=='saved_recipes')throw Error('Reports must use atomic RPC');return {
  select(){return this;},eq(key,value){s.filters.push([table,key,value]);return this;},
  async maybeSingle(){if(s.recipeThrows)throw Error('recipe outage');return s.recipe;}
 };}
}; }
`;
registerHooks({resolve(specifier,context,nextResolve){
 if(specifier==='./_lib/supabaseAdmin'&&context.parentURL?.endsWith('/api/content-reports.ts'))return {url:'data:text/javascript,'+encodeURIComponent(stub),shortCircuit:true};
 return nextResolve(specifier,context);
}});
const {default:handler}=await import('../api/content-reports.ts');
let cases=0;
function state(changes={}){
 return globalThis.__reports={auth:{data:{user:{id:'verified-account'}},error:null},rpc:{data:reportId,error:null},rpcCalls:[],filters:[],writes:[],count:0,
  recipe:{data:{id:recipeId,name:'Canonical recipe',description:'Saved description',type:'topper',updated_at:'2026-09-23',recipe_data:{ingredients:[{name:'Chicken'}],instructions:[{instruction:'Cook safely'}],imageUrl:'data:image/png;base64,YWJj'}},error:null},...changes};
}
function request(body={source:'recipe',recipeId,reason:'unsafe'}, options={}){
 return new Request('https://app.invalid/api/content-reports',{method:options.method??'POST',headers:{authorization:'Bearer synthetic', 'content-type':'application/json',...options.headers},...(options.method==='GET'?{}:{body:typeof body==='string'?body:JSON.stringify(body)})});
}
async function check(name,{body,changes={},options={}}={},status=400,writes=0){
 const s=state(changes);const response=await handler(request(body,options));assert.equal(response.status,status,name);assert.equal(s.writes.length,writes,name+' durable writes');cases++;return {s,response};
}
await check('method',{options:{method:'GET'}},405);
await check('anonymous',{options:{headers:{authorization:''}},body:'x'.repeat(150000)},401);
await check('expired session',{changes:{auth:{data:{user:null},error:Error('expired')}}},401);
await check('auth outage',{changes:{authThrows:true}},503);
await check('wrong content type',{options:{headers:{'content-type':'text/plain'}}},415);
for(const body of ['not JSON',null,[],{source:'banana',reason:'unsafe'},{source:['chat'],recipeId,reason:'unsafe'},{source:'recipe',recipeId,reason:'bogus'},{source:'recipe',recipeId:'bad-id',reason:'unsafe'},{source:'chat',reason:'unsafe',message:''},{source:'chat',reason:'unsafe',message:'x'.repeat(16001)},{source:'chat',reason:'unsafe',message:'fine',details:'x'.repeat(501)}])await check('invalid body',{body});
const oversize=await check('stream cap',{body:'x'.repeat(131073)},413);assert.equal(oversize.s.rpcCalls.length,0);
await check('announced cap',{options:{headers:{'content-length':'999999'}}},413);
await check('invalid length',{options:{headers:{'content-length':'not-a-number'}}},413);
await check('multibyte cap',{body:'🙂'.repeat(40000)},413);
for(const changes of [{rpcThrows:true},{rpc:{data:null,error:Error('outage')}},{rpc:{error:null}},{rpc:{data:{},error:null}},{rpc:{data:'invalid',error:null}},{rpc:{data:null,error:{code:'23503',message:'deleted auth-user foreign key'}}}])await check('atomic insert fails closed',{changes},503);
await check('rolling report limit',{changes:{rpc:{data:null,error:null}}},429);
const missing=await check('not owned or removed',{changes:{recipe:{data:null,error:null}}},404);assert.equal(missing.s.rpcCalls.length,0);
await check('recipe query error',{changes:{recipe:{data:null,error:Error('outage')}}},503);
await check('recipe query exception',{changes:{recipeThrows:true}},503);
const {s:canonical,response}=await check('canonical owned recipe',{body:{source:'recipe',recipeId,reason:'unsafe',user_id:'other-user',content_snapshot:{name:'forged'},status:'resolved'}},201,1);
assert.deepEqual(canonical.filters,[['saved_recipes','id',recipeId],['saved_recipes','user_id','verified-account']]);
const saved=canonical.writes[0];assert.equal(saved.p_content_title,'Canonical recipe');assert.equal(saved.p_user_id,'verified-account');assert.equal(saved.p_recipe_id,recipeId);assert.equal(saved.status,undefined);assert.equal(saved.p_content_snapshot.provenance,'owned_saved_recipe_at_report_time');assert.equal(saved.p_content_snapshot.image,undefined);
assert.deepEqual(await response.json(),{ok:true,id:reportId});assert.equal(response.headers.get('cache-control'),'no-store');assert.equal(canonical.rpcCalls.length,1);assert.equal(canonical.rpcCalls[0].name,'insert_ai_content_report_limited');assert.deepEqual(Object.keys(saved).sort(),['p_content_snapshot','p_content_title','p_details','p_reason','p_recipe_id','p_source','p_user_id']);
for(const reason of ['unsafe','offensive','incorrect','other']){
 const {s}=await check('selected chat '+reason,{body:{source:'chat',reason,message:'Selected assistant response',details:'My note',messageTruncated:true,recipeId}},201,1);
 assert.equal(s.filters.length,0);assert.equal(s.writes[0].p_recipe_id,null);assert.deepEqual(s.writes[0].p_content_snapshot,{kind:'chat',provenance:'user_submitted_selected_response',content:'Selected assistant response',truncated:true});
}
for(const [name,imageUrl,retained] of [['inline','data:image/png;base64,YWJj',true],['https','https://example.invalid/image.jpg',true],['oversized','data:image/jpeg;base64,'+'A'.repeat(600000),false],['unsupported','javascript:alert(1)',false],['missing',null,false]]){
 const recipe=state().recipe;recipe.data.recipe_data.imageUrl=imageUrl;
 const {s}=await check('image '+name,{body:{source:'image',recipeId,reason:'offensive'},changes:{recipe}},201,1);
 const evidence=s.writes[0].p_content_snapshot.image;assert.equal(evidence.retained,retained);assert.equal(evidence.reference,retained?imageUrl:undefined);if(imageUrl)assert.equal(evidence.sha256.length,64);
}
const largeRecipe=state().recipe;largeRecipe.data.recipe_data.instructions=['x'.repeat(200000)];const bounded=await check('large canonical field does not block report',{changes:{recipe:largeRecipe}},201,1);assert.equal(bounded.s.writes[0].p_content_snapshot.instructions.notRetained,true);
const emojiRecipe=state().recipe;emojiRecipe.data.name='x'.repeat(499)+'🐶';emojiRecipe.data.description='y'.repeat(1999)+'🐶';const emoji=await check('server truncation preserves valid Unicode',{changes:{recipe:emojiRecipe}},201,1);assert.equal(emoji.s.writes[0].p_content_title,'x'.repeat(499));assert.equal(emoji.s.writes[0].p_content_snapshot.description,'y'.repeat(1999));assert.equal(emoji.s.writes[0].p_content_title.isWellFormed(),true);
state({concurrent:true});const concurrent=await Promise.all(Array.from({length:20},()=>handler(request({source:'chat',reason:'unsafe',message:'Synthetic concurrent response'}))));assert.equal(concurrent.filter(r=>r.status===201).length,10);assert.equal(concurrent.filter(r=>r.status===429).length,10);assert.equal(globalThis.__reports.writes.length,10);cases++;
console.log(`Content reporting: ${cases} actual API cases passed; no network or live data used. Concurrent mock verifies handler obeys atomic insert/limit results, not the live database implementation.`);
