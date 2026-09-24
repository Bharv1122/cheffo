const{chromium}=require(process.env.PLAYWRIGHT_MODULE_PATH || 'playwright');
const assert=require('node:assert/strict');const fs=require('node:fs');
(async()=>{const browser=await chromium.launch({channel:'msedge',headless:true,args:['--use-fake-device-for-media-stream']});try{
 const context=await browser.newContext({permissions:['microphone']});
 const config=JSON.parse(fs.readFileSync(require('node:path').resolve(__dirname, '../vercel.json'),'utf8'));
 const policy=config.headers.flatMap(x=>x.headers).find(x=>x.key==='Permissions-Policy').value;
 assert.match(policy,/microphone=\(self\)/);assert.match(policy,/camera=\(\)/);
 await context.route('**/*',route=>route.fulfill({contentType:'text/html',headers:{'Permissions-Policy':route.request().url().endsWith('/old')?policy.replace('microphone=(self)','microphone=()'):policy},body:'<!doctype html><html><body>Synthetic microphone policy test; no real microphone recording.</body></html>'}));
 const page=await context.newPage();const results=[];
 for(const mode of ['old','current']){await page.goto('http://127.0.0.1:5190/'+mode);const result=await page.evaluate(async()=>{
  const allowed=document.featurePolicy.allowsFeature('microphone');
  try{const stream=await navigator.mediaDevices.getUserMedia({audio:true});stream.getTracks().forEach(t=>t.stop());return{allowed,audio:'synthetic stream opened'};}catch(e){return{allowed,audio:e.name};}
 });results.push({mode,...result});}
 assert.equal(results[0].allowed,false);assert.equal(results[0].audio,'NotAllowedError');
 assert.equal(results[1].allowed,true);assert.equal(results[1].audio,'synthetic stream opened');
 fs.writeFileSync(require('node:path').join(process.env.CHEFFO_TEST_OUTPUT_DIR || require('node:os').tmpdir(), 'microphone-policy-evidence.json'),JSON.stringify({policy,results,limitation:'Browser uses fake audio input. This verifies permission policy, not Web Speech recognition accuracy or physical Android voice.'},null,2));
 console.log('Microphone policy passed: former blanket block rejects; same-origin policy allows synthetic audio with explicit browser permission.');
}finally{await browser.close();}})().catch(e=>{console.error(e);process.exitCode=1});
