const {chromium}=require(process.env.PLAYWRIGHT_MODULE_PATH || 'playwright');
const assert=require('node:assert/strict');
const fs=require('node:fs');
let activeBrowser;
(async()=>{
const browser=await chromium.launch({channel:'msedge',headless:true});
activeBrowser=browser;
const context=await browser.newContext();
const page=await context.newPage();
const errors=[];page.on('pageerror',e=>errors.push(e.message));
await page.route('**/*',async route=>{
 const url=new URL(route.request().url());
 if(url.hostname!=='127.0.0.1')return route.abort();
 if(url.pathname==='/src/lib/supabase.ts')return route.fulfill({contentType:'application/javascript',body:'export const isSupabaseConfigured=true; export const supabase=window.__mockSupabase;'});
 return route.continue();
});
await page.addInitScript(()=>{
 let listener;let sessionResolve;const pending=[];
 window.__mockSupabase={auth:{
  getSession:()=>new Promise(resolve=>{sessionResolve=resolve;}),
  onAuthStateChange:callback=>{listener=callback;return{data:{subscription:{unsubscribe(){}}}};}
 },from(table){return{update(payload){window.__lastProfileUpdate=payload;const chain={eq(){return chain},then(resolve){resolve({error:null})}};return chain;},select(){return{eq(key,id){
  const result=()=>new Promise(resolve=>{pending.push({table,id,resolve});});
  return {order:result,maybeSingle:result};
 }}}}}};
 function session(id){return {user:{id,email:id+'@example.invalid'},access_token:'synthetic'};}
 window.__fixture={
  emit:id=>listener(id?'SIGNED_IN':'SIGNED_OUT',id?session(id):null),
  session:id=>sessionResolve({data:{session:session(id)}}),
  requests:id=>pending.filter(x=>x.id===id).length,
  resolveTreats(id,keepPagePending){
   const recipes=pending.filter(x=>x.id===id&&x.table==='saved_recipes');
   const first=recipes.at(-2);
   for(let i=pending.length-1;i>=0;i--){const p=pending[i];if(p.id!==id||keepPagePending&&p===first)continue;
    const data=p.table==='subscriptions'?null:p.table==='dog_profiles'?[{id:id+'-dog',name:id+' dog'}]:p.table==='user_preferences'?{active_profile_id:id+'-dog'}:[{id:'existing-treat',dog_profile_id:id+'-dog',name:'Existing Pumpkin Treat',type:'treat',recipe_data:{type:'treat',sourceTemplateId:'treat_pumpkin_oat_biscuits'}}];
    pending.splice(i,1);p.resolve({data,error:null});
   }
  },
  resolve(id,{premium=false,treat=false}={}){
   const rows={subscriptions:premium?{user_id:id,status:'active'}:null,
    saved_recipes:treat?[{id:id+'-recipe',user_id:id,dog_profile_id:id+'-dog',name:id+' treat',type:'treat',recipe_data:{type:'treat'}}]:[],
    dog_profiles:[{id:id+'-dog',user_id:id,name:id+' dog'}],user_preferences:{active_profile_id:id+'-dog'}};
   for(let i=pending.length-1;i>=0;i--)if(pending[i].id===id){const p=pending.splice(i,1)[0];p.resolve({data:rows[p.table],error:null});}
  }
 };
});
await page.goto('http://127.0.0.1:5186/tests/account-scope-harness.html');
await page.waitForSelector('#snapshot');
const snapshot=async()=>JSON.parse(await page.locator('#snapshot').innerText());
const records=[];
async function emit(id){await page.evaluate(id=>window.__fixture.emit(id),id);await page.waitForFunction(id=>JSON.parse(document.querySelector('#snapshot').textContent).user===id,id);await page.waitForFunction(id=>window.__fixture.requests(id)>=5,id);}
async function resolve(id,options={}){await page.evaluate(([id,options])=>window.__fixture.resolve(id,options),[id,options]);await page.waitForFunction(()=>{const s=JSON.parse(document.querySelector('#snapshot').textContent);return !s.accessLoading&&!s.profilesLoading&&!s.recipesLoading;});}
await emit('A');await resolve('A',{premium:true,treat:true});
let s=await snapshot();assert.equal(s.premium,true);assert.deepEqual(s.recipes,['A treat']);records.push(s);
await page.getByRole('button',{name:'Pending sign-in navigation'}).click();
await emit('B');s=await snapshot();assert.equal(s.premium,false);assert.equal(s.accessLoading,true);assert.deepEqual(s.recipes,[]);assert.deepEqual(s.profiles,[]);records.push(s);
await page.evaluate(()=>window.__continueNavigation());
await page.waitForFunction(()=>JSON.parse(document.querySelector('#snapshot').textContent).path==='/signed-in-destination');
await page.evaluate(()=>window.__fixture.session('A'));
await resolve('B',{treat:true});s=await snapshot();assert.equal(s.user,'B');assert.equal(s.premium,false);assert.equal(s.treatAllowed,false);assert.deepEqual(s.recipes,['B treat']);assert.deepEqual(s.profiles,['B dog']);assert.equal(s.path,'/signed-in-destination');records.push(s);
// Leave old account requests unresolved, then resolve them after the next switch.
await emit('OLD');await emit('C');
await page.evaluate(()=>window.__fixture.resolve('OLD',{premium:true,treat:true}));
s=await snapshot();assert.equal(s.user,'C');assert.equal(s.premium,false);assert.equal(s.accessLoading,true);assert.deepEqual(s.recipes,[]);assert.deepEqual(s.profiles,[]);
await resolve('C');s=await snapshot();assert.equal(s.premium,false);assert.equal(s.treatAllowed,true);assert.deepEqual(s.profiles,['C dog']);records.push(s);
await page.getByRole('button',{name:'Rename only',exact:true}).click();
assert.equal(await page.evaluate(()=>Object.hasOwn(window.__lastProfileUpdate,'ideal_weight_lbs')),false);
await page.getByRole('button',{name:'Clear ideal weight',exact:true}).click();
assert.equal(await page.evaluate(()=>window.__lastProfileUpdate.ideal_weight_lbs),null);
await page.goto('http://127.0.0.1:5186/tests/account-scope-harness.html?treats=1');
await page.waitForFunction(()=>!!window.__fixture);
await page.waitForSelector('article');
await page.evaluate(()=>window.__fixture.emit('RETURNING'));
await page.waitForFunction(()=>window.__fixture.requests('RETURNING')>=5);
await page.evaluate(()=>window.__fixture.resolveTreats('RETURNING',true));
const button=page.locator('article').first().getByRole('button');
assert.equal(await button.isDisabled(),true,'page recipe list must finish before actions become available');
await page.evaluate(()=>window.__fixture.resolveTreats('RETURNING',false));
await button.waitFor({state:'visible'});
await page.waitForFunction(()=>!document.querySelector('article button').disabled);
await button.click();
await page.waitForURL(/recipes\/existing-treat$/);
assert.deepEqual(errors,[]);
fs.writeFileSync(require('node:path').join(process.env.CHEFFO_TEST_OUTPUT_DIR || require('node:os').tmpdir(), 'account-scope-evidence.json'),JSON.stringify({passed:true,cases:['loaded premium account cleared immediately on switch','returning free account treat gate','stale startup session cannot rewind auth','late previous-account data discarded','new free account allowance preserved','pending sign-in navigation survives scope remount','partial profile rename preserves ideal weight','explicit ideal-weight clear remains supported','Treats waits for its own delayed recipe query then opens existing recipe'],records,pageErrors:errors},null,2));
await browser.close();console.log('Account-scope browser regression passed: nine synthetic auth/data/navigation/profile/loading cases.');
})().catch(async e=>{console.error(e);if(activeBrowser)await activeBrowser.close();process.exit(1)});
