import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import { createRequire } from 'node:module';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import ts from 'typescript';
const require=createRequire(import.meta.url);
let count=0;
function fixture(file,{floating=false,replyStatus='error',unexpected=false,hold=false}={}){
 let messages=[],stateIndex=0,states=[],release;
 const fragment=({children})=>React.createElement(React.Fragment,null,children);
 const errorText="Ask Chef couldn't get an AI reply. Please try again in a moment.";
 const reply={status:replyStatus,errorCode:replyStatus==='error'?'unavailable':undefined,text:replyStatus==='error'?errorText:'Ingredients:\n- Egg 50 g\n- Rice 100 g\nInstructions:\n1. Cook thoroughly.\n2. Serve cooled.',parsedRecipe:null};
 const mockReact={...React,useEffect:()=>{},useRef:()=>({current:null}),useState:init=>{const index=stateIndex++;if(!(index in states))states[index]=floating&&index===0?true:typeof init==='function'?init():init;return [states[index],value=>{states[index]=typeof value==='function'?value(states[index]):value;}];}};
 const modules={
  react:mockReact,
  'react-router-dom':{Link:({children,to})=>React.createElement('a',{href:to},children)},
 };
 const source=ts.transpileModule(fs.readFileSync(new URL(file,import.meta.url),'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,jsx:ts.JsxEmit.ReactJSX,target:ts.ScriptTarget.ES2023,esModuleInterop:true}}).outputText;
 const context={exports:{},console,require(name){
   if(modules[name])return modules[name];
   if(name==='react/jsx-runtime'||name==='lucide-react')return require(name);
   if(name.endsWith('/AppShell'))return {AppShell:fragment};
   if(name.endsWith('/Button'))return {Button:({children,onClick,disabled})=>React.createElement('button',{onClick,disabled},children)};
   if(name.endsWith('/MessageContent'))return {MessageContent:({content})=>React.createElement('span',null,content)};
   if(name.endsWith('/UpgradeModal'))return {UpgradeModal:()=>null};
   if(name.endsWith('/useDogProfiles'))return {useDogProfiles:()=>({activeProfile:{id:'synthetic-dog'}})};
   if(name.endsWith('/useLocalStorage'))return {useLocalStorage:()=>[messages,update=>{messages=typeof update==='function'?update(messages):update;} ]};
   if(name.endsWith('/useRecipes'))return {useRecipes:()=>({saveRecipe:()=>{throw Error('Must not save during chat fixture');}})};
   if(name.endsWith('/usePaywall'))return {usePaywall:()=>({canUseFeature:()=>true,requireUpgrade:()=>{},isPremium:true,isLoading:false,upgradePrompt:{open:false}})};
   if(name.endsWith('/AuthContext'))return {useAuth:()=>({user:{id:'synthetic-user'}})};
   if(name.endsWith('/assistantChat'))return {ASSISTANT_UNAVAILABLE_MESSAGE:errorText,chatWithAssistant:async({onChunk})=>{onChunk?.('temporary streamed content');if(hold)await new Promise(resolve=>{release=resolve;});if(unexpected)throw Error('private internal detail');return reply;},looksLikeRecipe:()=>true};
   if(name.endsWith('/safetyValidator'))return {SHORT_VET_DISCLAIMER:'Synthetic disclaimer'};
   if(name.endsWith('/chatRecipeConverter'))return {};
   if(name.endsWith('/storage'))return {generateId:()=>`test-${Math.random()}`};
   if(name.endsWith('/distribution'))return {isGooglePlayApp:()=>true,ANDROID_ACCESS_MESSAGE:'Synthetic access message'};
   if(name.endsWith('/ReportContentButton'))return {ReportContentButton:()=>React.createElement('button',{'data-report':'present'},'Report reply')};
   throw Error('Unexpected fixture dependency: '+name);
 }};
 vm.runInNewContext(source,context,{filename:file});
 const Component=floating?context.exports.FloatingChatHead:context.exports.default;
 function tree(){stateIndex=0;return Component();}
 function findPrompt(node){if(!node||typeof node!=='object')return null;if(node.type==='button'&&typeof node.props?.onClick==='function'&&typeof node.props.children==='string'&&(/Can I add eggs|How much should I feed/.test(node.props.children)))return node;const children=React.Children.toArray(node.props?.children);for(const c of children){const hit=findPrompt(c);if(hit)return hit;}return null;}
 return{reply,release:()=>release(),async send(){const button=findPrompt(tree());assert.ok(button,'Actual quick prompt button found');await button.props.onClick();},render:()=>renderToStaticMarkup(tree()),messages:()=>messages};
}
for(const [file,floating]of [['../src/pages/Assistant/index.tsx',false],['../src/components/chat/FloatingChatHead.tsx',true]]){
 for(const unexpected of [false,true]){
  const f=fixture(file,{floating,unexpected});await f.send();const stored=f.messages().at(-1);assert.equal(stored.status,'error');assert.equal(stored.errorCode,'unavailable');assert.equal(stored.content,f.reply.text);assert.equal(stored.parsedRecipe,undefined);const html=f.render();assert.match(html,/AI reply unavailable/);assert.doesNotMatch(html,/data-report|Save to my recipes|private internal detail|temporary streamed content/);count++;
 }
 const held=fixture(file,{floating,hold:true});const pending=held.send();assert.doesNotMatch(held.render(),/data-report|Save to my recipes/);held.release();await pending;assert.match(held.render(),/AI reply unavailable/);count++;
 const success=fixture(file,{floating,replyStatus:'success'});await success.send();assert.equal(success.messages().at(-1).status,undefined);const html=success.render();assert.doesNotMatch(html,/AI reply unavailable/);assert.match(html,/data-report/);assert.match(html,/Save to my recipes/);count++;
}
console.log(`Ask Chef actual views: ${count} handler/render cases passed across page and floating chat; failure status persists, partial text is replaced, report/save hidden, success actions retained.`);
