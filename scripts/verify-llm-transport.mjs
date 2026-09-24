import assert from 'node:assert/strict';
import { registerHooks } from 'node:module';
// Exercise the actual Edge handler. Synthetic auth/DB and a fetch sink; no real
// credentials, external network, account creation or provider charges.
const stub = "export function getUserClient(){globalThis.__transport.authCalls++;return {auth:{getUser:async()=>({data:{user:{id:'transport-test',app_metadata:{cheffo_adult_confirmed:true}}},error:null})}};} export function getSupabaseAdmin(){return {from(){return {select(){return {eq(){return {maybeSingle:async()=>({data:{status:'active'},error:null})}}}}}},rpc:async()=>{globalThis.__transport.quotaCalls++;return {data:[{allowed:true}],error:null};}}}";
registerHooks({resolve(specifier,context,next){
  if(specifier==='./_lib/supabaseAdmin'&&context.parentURL?.endsWith('/api/llm.ts'))return {url:'data:text/javascript,'+encodeURIComponent(stub),shortCircuit:true};
  return next(specifier,context);
}});
process.env.LLM_API_KEY='synthetic-transport-key';
const {default:handler}=await import('../api/llm.ts');
let cases=0;
async function run(baseUrl,{image=false,redirect=false}={}){
 process.env.LLM_BASE_URL=baseUrl;globalThis.__transport={authCalls:0,quotaCalls:0,fetches:[],followedRedirects:0};
 globalThis.fetch=async(url,options)=>{
  __transport.fetches.push({url,options});
  if(redirect){
   // Native fetch rejects redirects when redirect:error. If that guarantee is
   // removed, this sink emulates following a redirect to an insecure origin.
   if(options.redirect==='error')throw new TypeError('synthetic redirect rejected');
   __transport.followedRedirects++;return new Response('unsafe redirected response');
  }
  return new Response('data: synthetic-stream\n\n',{headers:{'content-type':image?'application/json':'text/event-stream'}});
 };
 const response=await handler(new Request('https://app.invalid/api/llm'+(image?'?type=image':''),{method:'POST',headers:{authorization:'Bearer synthetic-session'},body:'{"messages":[]}' }));
 return {response,state:__transport};
}
for(const base of ['http://api.example.invalid/v1','https://user:password@api.example.invalid/v1','https://user@api.example.invalid/v1','not-a-url','ftp://api.example.invalid','https://api.example.invalid/v1?key=synthetic','https://api.example.invalid/v1#private']){
 const {response,state}=await run(base);assert.equal(response.status,500,base);assert.equal(state.fetches.length,0);assert.equal(state.authCalls,0);assert.equal(state.quotaCalls,0);cases++;
}
for(const [base,image,expected]of [
 ['https://api.openai.com/v1/',false,'https://api.openai.com/v1/chat/completions'],
 ['https://generativelanguage.googleapis.com/v1beta/openai/',false,'https://generativelanguage.googleapis.com/v1beta/openai/chat/completions'],
 ['https://api.example.invalid/custom/v1///',true,'https://api.example.invalid/custom/v1/images/generations'],
]){
 const {response,state}=await run(base,{image});assert.equal(response.status,200);assert.equal(state.fetches.length,1);
 assert.equal(state.fetches[0].url,expected);assert.equal(state.fetches[0].options.redirect,'error');assert.equal(state.fetches[0].options.headers.Authorization,'Bearer synthetic-transport-key');assert.equal(await response.text(),'data: synthetic-stream\n\n');cases++;
}
for(const image of [false,true]){
 const {response,state}=await run('https://api.example.invalid/v1',{image,redirect:true});
 assert.equal(response.status,502);assert.equal(state.fetches.length,1);assert.equal(state.followedRedirects,0);assert.ok(!(await response.text()).includes('synthetic-transport-key'));cases++;
}
console.log('PASS '+cases+' LLM transport cases: insecure/credential/malformed endpoints denied before auth/quota, HTTPS chat/image base paths preserved, redirects fail closed.');

