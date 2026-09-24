const {chromium}=require(process.env.PLAYWRIGHT_MODULE_PATH||'playwright');
const assert=require('node:assert/strict');const fs=require('node:fs');const path=require('node:path');
(async()=>{const browser=await chromium.launch({channel:'msedge',headless:true});try{
 const page=await browser.newPage({viewport:{width:390,height:844}});const errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.route('**/*',async route=>{const u=new URL(route.request().url());if(u.hostname!=='127.0.0.1')return route.abort();
  if(u.pathname==='/src/lib/supabase.ts')return route.fulfill({contentType:'application/javascript',body:'export const isSupabaseConfigured=true;export const supabase=window.__mockSupabase;'});
  if(u.pathname==='/signup')return route.fulfill({path:path.join(__dirname,'adult-confirmation-harness.html'),contentType:'text/html'});
  if(u.pathname.startsWith('/api/')){
   if(u.pathname==='/api/llm')await page.evaluate(()=>window.__aiCalls++);
   if(u.pathname==='/api/account/confirm-adult'){
    const state=await page.evaluate(()=>({fail:window.__failConfirmation,payloads:window.__confirmBodies.push(null)}));
    await page.evaluate(body=>{window.__confirmBodies[window.__confirmBodies.length-1]=body;},route.request().postDataJSON());
    if(state.fail)return route.fulfill({status:503,json:{error:'test outage'}});
    await page.evaluate(()=>{window.__session.user.app_metadata.cheffo_adult_confirmed=true;});
    return route.fulfill({json:{confirmed:true}});
   }
   return route.fulfill({json:{ok:true}});
  }return route.continue();});
 await page.addInitScript(()=>{if(new URLSearchParams(location.search).has('signup'))history.replaceState(null,'','/signup');let listener;window.__aiCalls=0;window.__confirmBodies=[];window.__signupCalls=0;window.__failConfirmation=false;
 const make=id=>({user:{id,email:id+'@example.invalid',app_metadata:{},user_metadata:{cheffo_adult_confirmed:true}},access_token:'synthetic-'+id});
 window.__session=location.pathname==='/signup'?null:make('existing');
 window.__mockSupabase={auth:{getSession:async()=>({data:{session:window.__session}}),getUser:async()=>({data:{user:window.__session?.user},error:null}),onAuthStateChange:cb=>{listener=cb;return{data:{subscription:{unsubscribe(){}}}};},signUp:async()=>{window.__signupCalls++;window.__session=make('new-user');listener('SIGNED_IN',window.__session);return{data:{session:window.__session,user:window.__session.user},error:null};}}};
 window.__switch=id=>{window.__session=id?make(id):null;listener('SIGNED_IN',window.__session);};});
 await page.goto('http://127.0.0.1:5186/tests/adult-confirmation-harness.html');await page.locator('#identity').filter({hasText:'existing'}).waitFor();
 await page.getByRole('button',{name:'Try AI',exact:true}).click();const dialog=page.getByRole('dialog');await dialog.waitFor();assert.equal(await page.getByRole('checkbox').isChecked(),false);assert.equal(await page.getByRole('button',{name:'Confirm and continue'}).isEnabled(),false);assert.equal(await page.evaluate(()=>window.__aiCalls),0);
 const out=process.env.CHEFFO_TEST_OUTPUT_DIR||require('node:os').tmpdir();await page.screenshot({path:path.join(out,'adult-confirmation-mobile.png')});
 await page.getByRole('button',{name:'Not now',exact:true}).click();await page.locator('#result').filter({hasText:'require confirmation'}).waitFor();await page.getByText('Saved recipe remains available').waitFor();assert.equal(await page.evaluate(()=>window.__aiCalls),0);
 await page.getByRole('button',{name:'Try AI',exact:true}).click();await page.getByRole('checkbox').check();await page.evaluate(()=>window.__failConfirmation=true);await page.getByRole('button',{name:'Confirm and continue'}).click();await page.getByRole('alert').waitFor();assert.equal(await page.evaluate(()=>window.__aiCalls),0);
 await page.evaluate(()=>window.__failConfirmation=false);await page.getByRole('button',{name:'Confirm and continue'}).click();await page.locator('#result').filter({hasText:'AI requested'}).waitFor();assert.equal(await page.evaluate(()=>window.__aiCalls),1);assert.deepEqual(await page.evaluate(()=>window.__confirmBodies.at(-1)),{adult_confirmed:true});
 await page.getByRole('button',{name:'Try AI',exact:true}).click();await page.waitForFunction(()=>window.__aiCalls===2);assert.equal(await dialog.count(),0);
 await page.evaluate(()=>window.__switch('second'));await page.locator('#identity').filter({hasText:'second'}).waitFor();await page.getByRole('button',{name:'Try AI',exact:true}).click();await dialog.waitFor();await page.evaluate(()=>window.__switch('third'));await page.locator('#identity').filter({hasText:'third'}).waitFor();assert.equal(await dialog.count(),0);assert.equal(await page.evaluate(()=>window.__aiCalls),2);
 await page.goto('http://127.0.0.1:5186/tests/adult-confirmation-harness.html?signup=1');await page.getByRole('heading',{name:'Create your Cheffo Doggo account'}).waitFor();const box=page.getByRole('checkbox');assert.equal(await box.isChecked(),false);await page.getByLabel(/^Email/).fill('test@example.invalid');await page.getByLabel(/^Password/).fill('synthetic-test-password');await page.getByRole('button',{name:'Create Account'}).click();assert.equal(await page.evaluate(()=>window.__signupCalls),0);await box.check();await page.getByRole('button',{name:'Create Account'}).click();await page.waitForFunction(()=>window.__signupCalls===1&&window.__confirmBodies.length===1);assert.deepEqual(await page.evaluate(()=>window.__confirmBodies[0]),{adult_confirmed:true});assert.deepEqual(errors,[]);
 fs.writeFileSync(path.join(out,'adult-confirmation-browser-evidence.json'),JSON.stringify({passed:true,cases:['unchecked new signup','existing-user prompt ignores user_metadata','cancel preserves account access','save outage blocks AI','acknowledge and resume','already confirmed no prompt','account switch cancels pending AI','signup acknowledgement uses authenticated endpoint'],pageErrors:errors},null,2));console.log('Adult UI verification passed: signup, existing acknowledgement, failure/cancel, trusted gate, and account-switch cancellation.');
}finally{await browser.close();}})().catch(e=>{console.error(e);process.exitCode=1;});
