import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import { registerHooks } from 'node:module';
import ts from 'typescript';
registerHooks({resolve(specifier,context,next){
  if(specifier==='./analyticsPrivacy'&&context.parentURL?.endsWith('/src/lib/funnelAnalytics.ts'))return next('./analyticsPrivacy.ts',context);
  return next(specifier,context);
}});
const privacy=await import('../src/lib/analyticsPrivacy.ts');
const {trackFunnelEvent}=await import('../src/lib/funnelAnalytics.ts');
const origin='https://cheffodoggo.com';let cases=0;
for(const path of ['/vet-approve/synthetic-private-token','/recipes/synthetic-private-id','/profiles/id/edit','/cook/id','/vet-export/id','/reset-password','/unknown/private','/%76et-approve/token']){
  assert.equal(privacy.canStartTelemetry(origin+path,origin,''),false,path);
  assert.equal(privacy.redactTelemetryEvent({type:'pageview',url:origin+path},origin,''),null,path);cases++;
}
for(const suffix of ['?token=private','?access_token=private','#access_token=private','?src=person%40example.invalid','?distribution=private']){
  assert.equal(privacy.canStartTelemetry(origin+'/signup'+suffix,origin,''),false,suffix);cases++;
}
for(const referrer of [origin+'/vet-approve/private',origin+'/?token=private','https://external.invalid/person/private','https://external.invalid/?token=private']){
  assert.equal(privacy.redactTelemetryEvent({type:'vital',url:origin+'/'},origin,referrer),null);cases++;
}
assert.deepEqual(privacy.redactTelemetryEvent({type:'pageview',url:origin+'/signup?src=card'},origin,''),{type:'pageview',url:origin+'/signup'});cases++;
assert.deepEqual(privacy.redactTelemetryEvent({type:'vital',url:origin+'/?distribution=google-play',route:'/'},origin,'https://example.invalid/'),{type:'vital',url:origin+'/',route:'/'});cases++;
assert.equal(privacy.redactTelemetryEvent({type:'vital',url:origin+'/',route:'/vet-approve/private'},origin,''),null);cases++;
assert.equal(privacy.redactTelemetryEvent({type:'pageview',url:'https://elsewhere.invalid/'},origin,''),null);cases++;
assert.equal(privacy.redactTelemetryEvent({type:'pageview',url:'https://person:secret@cheffodoggo.com/'},origin,''),null);cases++;
assert.equal(privacy.redactTelemetryEvent({type:'pageview',url:'data:text/plain,private'},origin,''),null);cases++;

// Exercise the actual main.tsx initialization and both registered callbacks,
// replacing only browser/rendering/SDK side effects. Private pages still render.
const main=ts.transpileModule(fs.readFileSync(new URL('../src/main.tsx',import.meta.url),'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,jsx:ts.JsxEmit.ReactJSX,target:ts.ScriptTarget.ES2023}}).outputText;
function runMain(url,referrer=''){
  const calls=[];let rendered=false;
  const context={exports:{},window:{location:{href:url,origin}},document:{referrer,getElementById:()=>({})},require(name){
    if(name==='@vercel/analytics')return {inject:options=>calls.push({sdk:'analytics',...options})};
    if(name==='@vercel/speed-insights')return {injectSpeedInsights:options=>calls.push({sdk:'speed',...options})};
    if(name==='./lib/analyticsPrivacy')return privacy;
    if(name==='react-dom/client')return {createRoot:()=>({render(){rendered=true;}})};
    if(name==='react/jsx-runtime')return {jsx:()=>({}),jsxs:()=>({})};
    return {};
  }};
  vm.runInNewContext(main,context);assert.equal(rendered,true);return calls;
}
assert.equal(runMain(origin+'/vet-approve/synthetic-private-token').length,0);cases++;
assert.equal(runMain(origin+'/reset-password#access_token=private').length,0);cases++;
const sdkCalls=runMain(origin+'/signup?src=calculator');assert.equal(sdkCalls.length,2);cases++;
for(const sdk of sdkCalls){
  assert.equal(sdk.beforeSend({type:sdk.sdk==='speed'?'vital':'pageview',url:origin+'/vet-approve/private'}),null);
  assert.equal(sdk.beforeSend({type:sdk.sdk==='speed'?'vital':'pageview',url:origin+'/signup?src=card'}).url,origin+'/signup');cases++;
}

// Exercise the real funnel call with a synthetic network sink. No external calls.
const sent=[];globalThis.window={location:{pathname:'/vet-approve/synthetic-private-token'}};
globalThis.localStorage={getItem:()=> 'person@example.invalid'};
globalThis.fetch=async(url,init)=>{sent.push({url,payload:JSON.parse(init.body)});return new Response('{}');};
await trackFunnelEvent('return_visit');assert.equal(sent.length,0);cases++;
window.location.pathname='/signup';await trackFunnelEvent('signup_viewed');assert.deepEqual(sent[0].payload,{event:'signup_viewed',path:'/signup',source:null});cases++;
localStorage.getItem=()=> 'card';await trackFunnelEvent('signup_completed');assert.equal(sent[1].payload.source,'card');cases++;
assert.ok(!JSON.stringify(sent).includes('private-token'));assert.ok(!JSON.stringify(sent).includes('person@'));cases++;
console.log(`PASS ${cases} analytics privacy cases: private initial routes, both SDK callbacks, safe aggregate paths and actual funnel network payloads.`);
