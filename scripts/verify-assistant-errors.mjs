import assert from 'node:assert/strict';
import { registerHooks } from 'node:module';
const adultStub=`export class AdultConfirmationError extends Error {} export async function buildAdultAiHeaders(){if(globalThis.__assistantAdultError)throw new AdultConfirmationError('AI features require confirmation that you are at least 18.');return {'Content-Type':'application/json',Authorization:'Bearer synthetic-test-token'};}`;
registerHooks({resolve(specifier,context,nextResolve){if(specifier==='../lib/adultConfirmation'&&context.parentURL?.endsWith('/src/utils/assistantChat.ts'))return {url:'data:text/javascript,'+encodeURIComponent(adultStub),shortCircuit:true};return nextResolve(specifier,context);}});
const {chatWithAssistant,ASSISTANT_UNAVAILABLE_MESSAGE}=await import('../src/utils/assistantChat.ts');
let cases=0;
const encoder=new TextEncoder();
const event=obj=>'data: '+JSON.stringify(obj)+'\n\n';
const delta=text=>event({choices:[{delta:{content:text},finish_reason:null}]});
function sse(text,{split=Infinity,readError=false}={}){const bytes=encoder.encode(text);return new Response(new ReadableStream({start(c){for(let i=0;i<bytes.length;i+=split)c.enqueue(bytes.slice(i,i+split));if(readError)c.error(Error('private upstream detail'));else c.close();}}),{headers:{'Content-Type':'text/event-stream'}});}
async function run(name,response,expected,{history=[],expectedCode,expectedText=ASSISTANT_UNAVAILABLE_MESSAGE}={}){
 let request,chunks=[];globalThis.fetch=async(url,init)=>{request={url,init};if(response instanceof Error)throw response;return response;};
 const result=await chatWithAssistant({history,userMessage:'Can I add eggs to recipes?',onChunk:t=>chunks.push(t)});
 assert.equal(result.status,expected,name);
 if(expected==='error'){assert.equal(result.errorCode,expectedCode??'unavailable',name);assert.equal(result.text,expectedText,name);assert.equal(result.parsedRecipe,null,name);assert.ok(!result.text.includes('private upstream'),name);assert.ok(!result.text.includes('Hi there!'),name);}
 else assert.equal(result.text,expectedText,name);
 cases++;return {result,request,chunks};
}
const body=(status,error,extra={})=>new Response(JSON.stringify({error,...extra}),{status,headers:{'content-type':'application/json'}});
await run('observed provider error becomes explicit notice, never canned greeting',body(502,'private upstream detail'),'error');
for(const status of [400,403,404,429,500,503])await run('provider '+status+' remains safe',body(status,'private upstream detail'),'error');
await run('auth denial preserves sign-in action',body(401,'Your session has expired — please sign in again.'),'error',{expectedCode:'sign_in',expectedText:'Please sign in again to use Ask Chef.'});
await run('provider auth denial is not mistaken for user session',body(401,'API key rejected: private upstream detail'),'error');
await run('premium denial preserved',body(403,'AI chat and generated recipe images require Premium access.'),'error',{expectedCode:'access',expectedText:'Ask Chef requires Premium access. Check your account access in Settings.'});
await run('own daily quota action preserved',body(429,'Daily AI limit reached (100 requests). Try again tomorrow.'),'error',{expectedCode:'limit',expectedText:'Your daily AI limit has been reached. Try again tomorrow.'});
await run('fresh server adult denial preserved',body(403,'ignored',{code:'ADULT_CONFIRMATION_REQUIRED'}),'error',{expectedCode:'adult_confirmation',expectedText:'Confirm that you are at least 18 before using AI features.'});
globalThis.__assistantAdultError=true;
const adult=await run('existing local adult gate remains explicit',body(200,''),'error',{expectedCode:'adult_confirmation',expectedText:'AI features require confirmation that you are at least 18.'});assert.equal(adult.request,undefined);globalThis.__assistantAdultError=false;
await run('network rejection',new TypeError('private upstream detail'),'error');
await run('HTML SPA response rejected',new Response('<html>SPA fallback</html>',{headers:{'content-type':'text/html'}}),'error');
await run('JSON instead of requested SSE rejected',body(200,'private upstream detail'),'error');
await run('SSE provider error rejected',sse(event({error:{message:'private upstream detail'}})),'error');
await run('malformed stream rejected',sse('data: {broken\n\n'),'error');
await run('reader error rejected',sse('',{readError:true}),'error');
await run('empty completed stream is not success',sse('data: [DONE]\n\n'),'error',{expectedCode:'incomplete',expectedText:"Ask Chef didn't receive a complete AI reply. Please try again."});
const partial=await run('EOF without finish does not become complete answer',sse(delta('A partial answer')),'error',{expectedCode:'incomplete',expectedText:"Ask Chef didn't receive a complete AI reply. Please try again."});assert.equal(partial.chunks[0],'A partial answer');
await run('length-truncated stream is not success',sse(delta('A partial answer')+event({choices:[{delta:{},finish_reason:'length'}]})),'error',{expectedCode:'incomplete',expectedText:'The AI reply was interrupted. Please try your question again.'});
await run('safety interruption is not success',sse(event({choices:[{delta:{},finish_reason:'content_filter'}]})),'error',{expectedCode:'incomplete',expectedText:'The AI reply was interrupted. Please try your question again.'});
await run('valid SSE with split UTF8 and no trailing newline',sse(': keepalive\n\n'+delta('Hello 🐾')+'data: [DONE]',{split:1}),'success',{expectedText:'Hello 🐾'});
await run('normal finish_reason stop completes',sse(delta('Cook eggs thoroughly.')+event({choices:[{delta:{},finish_reason:'stop'}]})),'success',{expectedText:'Cook eggs thoroughly.'});
await run('thought blocks remain hidden',sse(delta('<thought>private reasoning</thought>Clear reply.')+'data: [DONE]\n'),'success',{expectedText:'Clear reply.'});
const history=[{id:'bad',role:'assistant',status:'error',content:'failure notice',timestamp:''},{id:'empty',role:'assistant',content:'',timestamp:''},{id:'good',role:'assistant',content:'previous real reply',timestamp:''}];
const filtered=await run('failed/empty replies excluded from next request',sse(delta('next reply')+'data: [DONE]\n'),'success',{history,expectedText:'next reply'});
const sent=JSON.parse(filtered.request.init.body);assert.ok(!sent.messages.some(m=>m.content==='failure notice'||m.content===''));assert.ok(sent.messages.some(m=>m.content==='previous real reply'));assert.equal(sent.model,'gemini-flash-lite-latest');assert.equal(sent.stream,true);assert.equal(filtered.request.init.headers.Authorization,'Bearer synthetic-test-token');
console.log(`Ask Chef response handling: ${cases} cases passed; no network, real accounts, provider calls or persisted data.`);
