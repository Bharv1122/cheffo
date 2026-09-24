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
async function run(baseUrl,{image=false,redirect=false,redirectStatus=302,opaque=false}={}){
 process.env.LLM_BASE_URL=baseUrl;globalThis.__transport={authCalls:0,quotaCalls:0,fetches:[],followedRedirects:0,cancelledRedirectBodies:0};
 globalThis.fetch=async(url,options)=>{
  __transport.fetches.push({url,options});
  if(redirect){
   // A manual response must be rejected without a second fetch or Location leak.
   if(options.redirect==='manual'){
    if(opaque)return {status:0,type:'opaqueredirect',body:null};
    const body=new ReadableStream({start(c){c.enqueue(new TextEncoder().encode('synthetic-private-redirect-body'));},cancel(){__transport.cancelledRedirectBodies++;}});
    return new Response(body,{status:redirectStatus,headers:{Location:'http://synthetic-private-redirect.invalid/key'}});
   }
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
 assert.equal(state.fetches[0].url,expected);assert.equal(state.fetches[0].options.redirect,'manual');assert.equal(state.fetches[0].options.headers.Authorization,'Bearer synthetic-transport-key');assert.equal(await response.text(),'data: synthetic-stream\n\n');cases++;
}
for(const image of [false,true])for(const redirectStatus of [301,302,303,307,308]){
 const {response,state}=await run('https://api.example.invalid/v1',{image,redirect:true,redirectStatus});
 assert.equal(response.status,502);assert.equal(state.fetches.length,1);assert.equal(state.followedRedirects,0);assert.equal(state.cancelledRedirectBodies,1);assert.equal(response.headers.get('location'),null);assert.deepEqual(await response.json(),{error:'Upstream LLM request failed'});cases++;
}
const opaque=await run('https://api.example.invalid/v1',{redirect:true,opaque:true});assert.equal(opaque.response.status,502);assert.equal(opaque.state.fetches.length,1);assert.equal(opaque.state.followedRedirects,0);cases++;
console.log('PASS '+cases+' LLM transport cases: insecure/credential/malformed endpoints denied before auth/quota, HTTPS chat/image base paths preserved, redirects fail closed.');
