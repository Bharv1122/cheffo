import assert from 'node:assert/strict';
import {registerHooks} from 'node:module';
const stub=`
export function getUserClient(){return {auth:{getUser:async()=>globalThis.__export.auth},from:table=>({select:async()=>({data:[],error:null})})};}
export function getSupabaseAdmin(){return {from:table=>({select:()=>({eq:async(key,value)=>{globalThis.__export.filters.push({table,key,value});return {data:[{id:'own-report'}],error:null};}})})};}
`;
registerHooks({resolve(specifier,context,nextResolve){if(specifier==='../_lib/supabaseAdmin'&&context.parentURL?.endsWith('/api/account/export.ts'))return{url:'data:text/javascript,'+encodeURIComponent(stub),shortCircuit:true};return nextResolve(specifier,context);}});
const {default:handler}=await import('../api/account/export.ts');
globalThis.__export={filters:[],auth:{data:{user:{id:'verified-user',app_metadata:{cheffo_adult_confirmed:true,cheffo_adult_confirmed_at:'2026-09-24',cheffo_adult_policy:'18-plus-v1',private_unrelated:'must-not-export'}}},error:null}};
const response=await handler(new Request('https://test.invalid/api/account/export',{method:'POST',headers:{authorization:'Bearer synthetic'},body:JSON.stringify({userId:'other-user'})}));
assert.equal(response.status,200);const body=await response.json();assert.deepEqual(globalThis.__export.filters,[{table:'ai_content_reports',key:'user_id',value:'verified-user'}]);assert.deepEqual(body.contentReports,[{id:'own-report'}]);assert.deepEqual(body.user.ageConfirmation,{confirmed:true,confirmedAt:'2026-09-24',policy:'18-plus-v1'});assert.equal(JSON.stringify(body).includes('must-not-export'),false);
globalThis.__export.auth.data.user.app_metadata={cheffo_adult_confirmed:'true'};const unconfirmed=await handler(new Request('https://test.invalid/api/account/export',{method:'POST',headers:{authorization:'Bearer synthetic'}}));assert.deepEqual((await unconfirmed.json()).user.ageConfirmation,{confirmed:false,confirmedAt:null,policy:null});
globalThis.__export.auth={data:{user:null},error:Error('expired')};const denied=await handler(new Request('https://test.invalid/api/account/export',{method:'POST',headers:{authorization:'Bearer synthetic'}}));assert.equal(denied.status,401);
console.log('Report export: verified user scope, narrow age metadata and invalid-session checks passed.');
