import assert from 'node:assert/strict';
import { registerHooks } from 'node:module';
const stub=`export function getUserClient(){globalThis.__diagnostics.auth++;return {auth:{getUser:async()=>({data:{user:{id:'synthetic-diagnostics-user',app_metadata:{cheffo_adult_confirmed:true}}},error:null})}};}export function getSupabaseAdmin(){return {from(){return {select(){return {eq(){return {maybeSingle:async()=>({data:{status:'active'},error:null})}}}}}},rpc:async()=>{globalThis.__diagnostics.quota++;return {data:[{allowed:true}],error:null};}};}`;
registerHooks({resolve(specifier,context,next){if(specifier==='./_lib/supabaseAdmin'&&context.parentURL?.endsWith('/api/llm.ts'))return {url:'data:text/javascript,'+encodeURIComponent(stub),shortCircuit:true};return next(specifier,context);}});
process.env.LLM_API_KEY='synthetic-private-key-never-log';
process.env.LLM_BASE_URL='https://synthetic-private-host.invalid/v1';
const {default:handler}=await import('../api/llm.ts');
let cases=0;
const originalConsoleError=console.error;
async function run(upstream,{token=true,key='synthetic-private-key-never-log',base='https://synthetic-private-host.invalid/v1'}={}){
 process.env.LLM_API_KEY=key;process.env.LLM_BASE_URL=base;
 const logs=[],state={auth:0,quota:0,requests:[]};globalThis.__diagnostics=state;
 console.error=(...args)=>logs.push(args);
 globalThis.fetch=async(url,options)=>{state.requests.push({url,options});return upstream();};
 try{
  const response=await handler(new Request('https://app.invalid/api/llm',{method:'POST',headers:token?{authorization:'Bearer synthetic-private-token'}:{},body:'{"messages":[{"role":"user","content":"synthetic-private-user-content"}]}'}));
  return {response,logs,state};
 }finally{console.error=originalConsoleError;}
}
function checkSafe(logs){const serialized=JSON.stringify(logs);for(const word of ['synthetic-private','Bearer','http:','https:','stack','body','headers'])assert.ok(!serialized.includes(word),'No private diagnostic value: '+word);}
async function failure(name,error,errorName='unknown',causeCode='unknown',{expected={},...options}={}){
 const {response,logs,state}=await run(()=>{throw error;},options);assert.equal(response.status,502,name);assert.deepEqual(await response.json(),{error:'Upstream LLM request failed'});
 assert.deepEqual(logs,[['[llm] upstream_failure',{stage:'fetch_exception',status:502,errorName,causeCode,errorHint:'unknown',authorizationValueValid:true,keyHasLineBreak:false,keyHasOuterWhitespace:false,providerIsGoogle:false,baseHasExpectedGooglePath:false,...expected}]],name);checkSafe(logs);
 assert.equal(state.auth,1);assert.equal(state.quota,1);assert.equal(state.requests.length,1);assert.equal(state.requests[0].options.redirect,'manual');cases++;
}
await failure('ordinary edge fetch exception',new TypeError('synthetic-private-url https://synthetic-private-host.invalid/'),'TypeError');
for(const causeCode of ['ENOTFOUND','EAI_AGAIN','ECONNREFUSED','ECONNRESET','ETIMEDOUT','UND_ERR_CONNECT_TIMEOUT','UND_ERR_HEADERS_TIMEOUT','UND_ERR_BODY_TIMEOUT','UND_ERR_SOCKET','CERT_HAS_EXPIRED','DEPTH_ZERO_SELF_SIGNED_CERT','ERR_TLS_CERT_ALTNAME_INVALID','UNABLE_TO_VERIFY_LEAF_SIGNATURE','UNABLE_TO_GET_ISSUER_CERT_LOCALLY']){
 await failure('allowlisted transport cause '+causeCode,new TypeError('synthetic-private-message',{cause:{code:causeCode,message:'synthetic-private-provider-message',hostname:'synthetic-private-host.invalid'}}),'TypeError',causeCode);
}
await failure('unknown codes/names collapse',{name:'synthetic-private-name',cause:{code:'ENOTFOUND synthetic-private-host'},stack:'synthetic-private-stack'});
await failure('string rejection never serialized','synthetic-private-key-never-log');
await failure('null rejection',null);
await failure('throwing getter ignored',Object.defineProperty({},'name',{get(){throw Error('synthetic-private-message');}}));
let reads=0;await failure('changing getter read exactly once',{get name(){reads++;return reads===1?'TypeError':'synthetic-private-secret';},cause:{code:'ENOTFOUND'}},'TypeError','ENOTFOUND');assert.equal(reads,1);
await failure('throwing cause getter keeps safe error name',{name:'AbortError',get cause(){throw Error('synthetic-private-message');}},'AbortError');
for(const [message,hint] of [['unexpected redirect to synthetic-private-url','redirect_rejected'],['Redirect mode is set to error: synthetic-private-host','redirect_rejected'],['Invalid character in header content synthetic-private-key','invalid_header'],['Cannot convert argument to a ByteString: synthetic-private-key','invalid_header'],['getaddrinfo ENOTFOUND synthetic-private-host','dns_failure'],['TLS handshake failed: synthetic-private-host','tls_failure']]){
 await failure('safe message classifier '+hint,new TypeError(message),'TypeError','unknown',{expected:{errorHint:hint}});
 await failure('safe nested cause classifier '+hint,new TypeError('fetch failed',{cause:{message}}),'TypeError','unknown',{expected:{errorHint:hint}});
}
await failure('non-diagnostic words do not imply redirect',new TypeError('synthetic-private-host-redirect.example failed'),'TypeError');
await failure('overlong message ignored',new TypeError('unexpected redirect '+'synthetic-private'.repeat(200)),'TypeError');
await failure('throwing message property remains safe',{name:'TypeError',get message(){throw Error('synthetic-private-message');}},'TypeError');
let messageReads=0;await failure('message getter read once',{name:'TypeError',get message(){messageReads++;return messageReads===1?'unexpected redirect':'synthetic-private-key';}},'TypeError','unknown',{expected:{errorHint:'redirect_rejected'}});assert.equal(messageReads,1);
await failure('newline credential structurally invalid',new TypeError('fetch failed'),'TypeError','unknown',{key:'synthetic-private\nkey',expected:{authorizationValueValid:false,keyHasLineBreak:true}});
await failure('carriage return credential structurally invalid',new TypeError('fetch failed'),'TypeError','unknown',{key:'synthetic-private\rkey',expected:{authorizationValueValid:false,keyHasLineBreak:true}});
await failure('unicode credential structurally invalid',new TypeError('fetch failed'),'TypeError','unknown',{key:'synthetic-private-\u2603',expected:{authorizationValueValid:false}});
await failure('outer spaces identified without changing credential',new TypeError('fetch failed'),'TypeError','unknown',{key:' synthetic-private ',expected:{keyHasOuterWhitespace:true}});
await failure('expected Google shape only booleans',new TypeError('fetch failed'),'TypeError','unknown',{base:'https://generativelanguage.googleapis.com/v1beta/openai/',expected:{providerIsGoogle:true,baseHasExpectedGooglePath:true}});
await failure('Google unexpected path flagged',new TypeError('fetch failed'),'TypeError','unknown',{base:'https://generativelanguage.googleapis.com/synthetic-private-path',expected:{providerIsGoogle:true}});
await failure('lookalike Google host is not Google',new TypeError('fetch failed'),'TypeError','unknown',{base:'https://generativelanguage.googleapis.com.synthetic-private.invalid/v1beta/openai',expected:{baseHasExpectedGooglePath:true}});
for(const status of [400,401,403,429,500,502,503]){
 const text='synthetic-private-provider-body';const upstream=new Response(text,{status,headers:{'content-type':'application/json','x-private':'synthetic-private-value'}});
 const {response,logs,state}=await run(()=>upstream);assert.equal(response.status,status);assert.equal(await response.text(),text,'Existing response passthrough unchanged');assert.deepEqual(logs,[['[llm] upstream_failure',{stage:'http_response',status}]]);checkSafe(logs);assert.equal(state.requests[0].options.headers.Authorization,'Bearer synthetic-private-key-never-log');cases++;
}
// Actual stream identity/chunks survive the diagnostic branch without buffering.
let controller;const stream=new ReadableStream({start(c){controller=c;c.enqueue(new TextEncoder().encode('data: first\n\n'));}});
const success=await run(()=>new Response(stream,{headers:{'content-type':'text/event-stream'}}));assert.equal(success.response.body,stream);assert.deepEqual(success.logs,[]);assert.equal(success.response.headers.get('Cache-Control'),'no-store');const reader=success.response.body.getReader();assert.equal(new TextDecoder().decode((await reader.read()).value),'data: first\n\n');controller.enqueue(new TextEncoder().encode('data: second\n\n'));controller.close();assert.equal(new TextDecoder().decode((await reader.read()).value),'data: second\n\n');assert.equal((await reader.read()).done,true);cases++;
const denied=await run(()=>{throw Error('Provider must not run');},{token:false});assert.equal(denied.response.status,401);assert.equal(denied.state.requests.length,0);assert.equal(denied.state.quota,0);assert.deepEqual(denied.logs,[]);cases++;
console.log(`LLM safe diagnostics: ${cases} cases passed; exact exception/HTTP status logs, no private-value leakage, unchanged authorization/redirect/forwarding and unbuffered successful stream.`);
