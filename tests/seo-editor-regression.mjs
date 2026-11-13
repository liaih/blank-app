import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const editor=readFileSync(new URL("../docs/seo-case-expansion.js",import.meta.url),"utf8");
const plan=JSON.parse(readFileSync(new URL("../docs/seo-improvement-plan.json",import.meta.url),"utf8"));
const media=JSON.parse(readFileSync(new URL("../docs/seo-media-rewrites.json",import.meta.url),"utf8"));
const drafts=JSON.parse(readFileSync(new URL("../docs/seo-rewrites.json",import.meta.url),"utf8"));

function sourceBetween(a,b){
 const begin=editor.indexOf(a),end=editor.indexOf(b,begin);
 assert.ok(begin>=0&&end>begin,"Missing editor function: "+a);
 return editor.slice(begin,end);
}
function context(storage,selectedId){
 const fields=new Map();
 const $=id=>{
  if(!fields.has(id))fields.set(id,{value:"",checked:false,textContent:"",dataset:{}});
  return fields.get(id);
 };
 const top={value:selectedId};
 const document={getElementById:id=>id==="action-article"?top:
  id==="action-view"?{value:"pending"}:null};
 const S={
  base:media.articles,drafts:drafts.articles,files:[],cmsUrls:[],
  cmsVisionCache:new Map(),cmsCorsUnavailable:false,
  activeProjectId:"",activeView:"pending",caseStates:new Map(),
  modelBusy:false,matchRunning:false,fileImportBusy:false,aiStarting:false,
  autosaveReady:false,autosaveTimer:null,recoveredProjects:0
 };
 const zones=["格局圖","玄關與客廳","玄關","客廳","客餐廳","廚房與走道","多功能工作區","臥室","更衣收納","其他"];
 const validUrl=x=>/^https:\/\/(?:www\.)?chen-yang\.com\.tw\/.+\.(?:png|jpg|jpeg|webp)$/i.test(String(x||""));
 let renders=0;
 const body=sourceBetween("function pickBase(){","function validUrl(text){");
 const funcs=new Function(
  "S","$","document","localStorage","zones","validUrl","renderItems",
  "renderCmsPairingReview","message","updateStatus","setTimeout","clearTimeout",
  body+"\nreturn {switchToCase,pickBase,articleContextMatches,saveCaseAutosave,restoreCaseAutosave};"
 )(S,$,document,storage,zones,validUrl,()=>{renders++},()=>{},()=>{},()=>{},()=>1,()=>{});
 return {S,$,top,funcs,get renders(){return renders}};
}
function browserStorage(){
 const map=new Map();
 return{
  getItem:k=>map.get(k)??null,
  setItem:(k,v)=>map.set(k,v),
  raw:key=>map.get(key)
 };
}

test("all improvement tasks have independently sourced original articles",()=>{
 assert.equal(plan.items.length,8);
 for(const task of plan.items){
  const article=media.articles.find(x=>x.id===task.id);
  assert.ok(article?.html_with_media,task.id);
  assert.match(article.html_with_media,/<img\b/i);
 }
});

test("switching all 8 projects keeps their captions and CMS image URLs separate",()=>{
 const store=browserStorage(),x=context(store,plan.items[0].id);
 for(const [index,task] of plan.items.entries()){
  x.top.value=task.id;
  assert.equal(x.funcs.switchToCase(task.id),true);
  assert.equal(x.funcs.pickBase().id,task.id);
  assert.equal(x.S.files.length,0,"Do not inherit a different case's images");
  x.S.files.push({name:"image-"+index+".png",role:"客廳",
   description:"Description "+task.id,alt:"ALT "+task.id,
   url:"https://chen-yang.com.tw/upload/"+index+".jpg",
   sha256:("a".repeat(63)+(index%10)),urlPairVerified:true,verified:true});
  x.$("cyexp-intro").value="Intro "+task.id;
  x.S.cmsUrls=["https://chen-yang.com.tw/upload/"+index+".jpg"];
 }
 for(const task of [...plan.items].reverse()){
  x.top.value=task.id;
  assert.equal(x.funcs.switchToCase(task.id),true);
  assert.equal(x.S.files[0].description,"Description "+task.id);
  assert.equal(x.S.files[0].alt,"ALT "+task.id);
  assert.equal(x.$("cyexp-intro").value,"Intro "+task.id);
 }
});

test("autosave recovers source-specific captions after reload without retaining image bytes or approval",()=>{
 const store=browserStorage(),x=context(store,plan.items[0].id),id=x.top.value;
 assert.ok(x.funcs.switchToCase(id));
 x.S.autosaveReady=true;
 const sha="a".repeat(64);
 x.S.files.push({name:"source.png",sha256:sha,role:"客廳",
  description:"AI description",alt:"A7 custom ALT",
  url:"https://chen-yang.com.tw/upload/a7.jpg",urlPairVerified:true,
  verified:true,file:{originalBytes:"not-persisted"},preview:"blob:sensitive"});
 x.$("cyexp-intro").value="Edited overview";
 x.$("cyexp-confirm-urls").checked=true;
 x.funcs.saveCaseAutosave();
 const raw=store.raw("chenyang-seo-case-drafts-v2");
 assert.ok(raw);
 assert.doesNotMatch(raw,/blob:sensitive|originalBytes|cyexp-local-token/);
 const y=context(store,id);
 assert.equal(y.funcs.restoreCaseAutosave(),1);
 assert.ok(y.funcs.switchToCase(id));
 const restored=y.S.files[0];
 assert.equal(restored.description,"AI description");
 assert.equal(restored.alt,"A7 custom ALT");
 assert.equal(restored.file,null);
 assert.equal(restored.preview,null);
 assert.equal(restored.urlPairVerified,false);
 assert.equal(restored.savedUrlPairVerified,true);
 assert.equal(restored.verified,false);
 assert.equal(y.$("cyexp-confirm-urls").checked,false);
 assert.equal(y.$("cyexp-intro").value,"Edited overview");
});

test("editor forbids generating mixed-article HTML, and the original known-image library is project scoped",()=>{
 assert.match(editor,/if\(!articleContextMatches\(\)\)throw Error\("文章選擇尚未同步/);
 assert.match(editor,/if\(S\.activeProjectId!=="seo-danfo-234"\)return false/);
 assert.doesNotMatch(editor,/const def=S\.base\.find\(x=>x\.id==="seo-danfo-234"\)/);
 assert.match(editor,/document\.addEventListener\("chenyang:seo-article-selection"/);
 assert.match(editor,/scheduleCaseAutosave\(\);\n}\nasync function loadKnown/);
});
