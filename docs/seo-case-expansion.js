/* 晨陽：同建案新增戶型。靜態站、本機圖片，不回傳原始圖給本站伺服器。 */
(function(){
"use strict";
const host=document.getElementById("case-expansion");
if(!host)return;
const $=id=>host.querySelector("#"+id);
const esc=s=>String(s??"").replace(/[&<>"']/g,ch=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[ch]));
const zones=["格局圖","玄關與客廳","玄關","客廳","客餐廳","廚房與走道","多功能工作區","臥室","更衣收納","其他"];
const S={base:[],drafts:[],known:new Map(),files:[],pipeline:null,modelBusy:false,visionReady:false,verifiedBase:false};
const markup=[
'<div class="cyexp-head"><h3>同建案新增案件｜AI 讀圖＋ALT＋格局圖</h3>',
'<p class="cyexp-muted">原文章＋舊戶型全部保留。新增圖片在本機辨識；圖片須先上傳晨陽官網取得正式網址，才可輸出正式 HTML。</p></div>',
'<div class="cyexp-fields">',
'<label>原建案文章<select id="cyexp-base"><option value="">正在載入原文章</option></select></label>',
'<label>新案件／戶型名稱（必填）<input id="cyexp-unit" placeholder="例如：新新增案代號；依真實戶別填寫"></label>',
'<label>素材類型<select id="cyexp-type"><option value="3D 建模示意圖">3D 建模示意圖（未完工）</option><option value="實景照片">真實完工照片（需確認確實完工）</option></select></label>',
'</div>',
'<label>新增案件整體介紹（可以自動產生後編輯）<textarea id="cyexp-intro" rows="3" placeholder="由已讀取的圖片描述組合，請核對。不可把 3D 示意圖稱為完工實景。"></textarea></label>',
'<div class="cyexp-actions"><label class="cyexp-file">選擇新案件圖片（可一次選多張）<input id="cyexp-files" type="file" accept="image/png,image/jpeg,image/webp,image/avif" multiple></label>',
'<button type="button" id="cyexp-read">自動讀圖／補齊介紹與 ALT</button>',
'<button type="button" id="cyexp-summary">依讀圖結果整理案件總覽</button></div>',
'<p class="cyexp-muted">本次丹佛花都 9 張原始示意圖已提供核對過的辨識結果；其他新圖可嘗試免費瀏覽器本機視覺模型（首次需下載模型、需裝置支援 WebGPU）。讀圖結果都是草稿，必須人工核對，無模型時不可假裝已辨識。</p>',
'<p id="cyexp-vision-status" class="cyexp-muted" role="status"></p>',
'<div id="cyexp-items" class="cyexp-images"><p>請選擇新案件圖片；包含新平面配置圖／格局圖。</p></div>',
'<details class="cyexp-advanced"><summary>進階｜原文不同步時貼上官網最新正文 HTML</summary>',
'<p class="cyexp-muted">既有原文預設取自通過保留驗收的改稿資料。若官網最近有人修改過，請貼入「最新後台正文 HTML」，避免用舊內容覆蓋新內容。貼入自訂原文時須自行核對原有圖片與格局圖。</p>',
'<textarea id="cyexp-newbase" rows="5" placeholder="可選：貼入最新原官網 CMS 正文 HTML；不要貼整頁 html/head/body"></textarea></details>',
'<label class="cyexp-check"><input type="checkbox" id="cyexp-confirm-base">我已核對原文章／舊戶型內容是最新的，原格局圖及既有圖片均保留</label>',
'<label class="cyexp-check"><input type="checkbox" id="cyexp-confirm-urls">新圖片已上傳晨陽官網，且我已逐一打開正式網址確認圖片能正常顯示</label>',
'<label class="cyexp-check"><input type="checkbox" id="cyexp-confirm-floorplan">新的平面配置圖／格局圖已確認對應這次新增的真實案件及戶型</label>',
'<div id="cyexp-status" class="cyexp-status" role="status">尚未選取新增圖片</div>',
'<div class="cyexp-actions"><button type="button" id="cyexp-copy" disabled>複製「原文＋新案件＋新格局圖」完整 HTML</button>',
'<button type="button" id="cyexp-export">匯出案件草稿 JSON</button>',
'<label class="cyexp-file">匯入先前草稿 JSON<input id="cyexp-import" type="file" accept=".json,application/json"></label></div>',
'<details class="cyexp-advanced"><summary>查看新增案件 HTML 預覽與完整原始碼</summary><div id="cyexp-preview"></div><textarea id="cyexp-html" readonly rows="7"></textarea></details>',
'<p class="cyexp-muted">不會自動上傳圖片或修改正式官網。草稿匯出不含圖片本體，重新開啟需重新選擇圖檔，官網圖片網址與 ALT 可由 JSON 恢復。</p>'
].join("");
host.innerHTML=markup;
function message(text,isError){$("cyexp-vision-status").textContent=text;$("cyexp-vision-status").style.color=isError?"#b91c1c":"";}
function pickBase(){return S.base.find(x=>x.id===$("cyexp-base").value);}
function chooseTitle(){const p=pickBase();const d=S.drafts.find(x=>x.id===p?.id);return d?.project_name || (d?.title||p?.id||"").split("｜",1)[0];}
function validUrl(text){
 try{const u=new URL(text);return u.protocol==="https:"&&["chen-yang.com.tw","www.chen-yang.com.tw"].includes(u.hostname.toLowerCase())&&/\.(png|jpe?g|webp|avif)$/i.test(u.pathname);}
 catch(_){return false;}
}
function textField(label,value,id,multi){
 const w=document.createElement("label");w.className="cyexp-field";
 const heading=document.createElement("span");heading.textContent=label;w.appendChild(heading);
 const f=document.createElement(multi?"textarea":"input");if(multi)f.rows=3;else f.type="text";
 f.value=value||"";f.dataset.attr=id;w.appendChild(f);return w;
}
async function identify(file){
 if(!window.crypto?.subtle)return "";
 const bytes=await file.arrayBuffer();const digest=await crypto.subtle.digest("SHA-256",bytes);
 return Array.from(new Uint8Array(digest)).map(x=>x.toString(16).padStart(2,"0")).join("");
}
function makeAlt(a){
 const project=chooseTitle();
 if(a.role==="格局圖")return project+"｜"+($("cyexp-unit").value.trim()||"新增案件")+"平面配置圖（請核對）";
 const detail=(a.altSuffix||a.description||"室內空間").slice(0,70);
 return project+"｜"+($("cyexp-unit").value.trim()||"新增案件")+"｜"+detail.replace(/[\r\n]+/g," ").slice(0,65)+
  "｜"+$("cyexp-type").value;
}
function enrichKnown(a){
 const known=S.known.get(a.sha256);
 if(!known)return false;
 a.role=known.zone;a.description=known.description;a.altSuffix=known.alt_suffix;
 a.alt=makeAlt(a);a.origin="已提供圖片的逐張辨識草稿（雜湊比對）";a.verified=false;return true;
}
function itemBox(a,i){
 const card=document.createElement("article");card.className="cyexp-item";
 const side=document.createElement("div");side.className="cyexp-thumb";
 if(a.preview){const img=document.createElement("img");img.src=a.preview;img.alt="僅供編輯者預覽的新圖片";side.appendChild(img);}
 else{const missing=document.createElement("div");missing.textContent="尚未重新選圖，可用正式圖片網址上稿";side.appendChild(missing);}
 const name=document.createElement("div");name.className="cyexp-muted";name.textContent=(i+1)+". "+(a.name||"已匯入圖片資料");side.appendChild(name);
 card.appendChild(side);
 const right=document.createElement("div");right.className="cyexp-item-fields";
 const role=document.createElement("label");role.textContent="圖片類型／空間";
 const sel=document.createElement("select");sel.dataset.attr="role";
 for(const z of zones){const op=document.createElement("option");op.value=z;op.textContent=z;sel.appendChild(op);}
 sel.value=a.role||"其他";role.appendChild(sel);right.appendChild(role);
 right.appendChild(textField("此圖的描述（來自圖像辨識，請核對）",a.description,"description",true));
 right.appendChild(textField("圖片 ALT（會寫入完整 HTML）",a.alt,"alt",false));
 right.appendChild(textField("晨陽官網正式圖片網址（必填）",a.url,"url",false));
 const state=document.createElement("p");state.className="cyexp-muted";
 state.textContent=a.origin||"尚未讀圖：請點「自動讀圖」，或自行描述畫面。";right.appendChild(state);
 const btns=document.createElement("div");btns.className="cyexp-actions";
 const confirm=document.createElement("label");confirm.className="cyexp-check";
 const box=document.createElement("input");box.type="checkbox";box.dataset.attr="verified";box.checked=!!a.verified;
 confirm.appendChild(box);confirm.appendChild(document.createTextNode("我已核對這張圖的空間、描述與 ALT"));btns.appendChild(confirm);
 const remove=document.createElement("button");remove.type="button";remove.textContent="移除圖片";
 remove.addEventListener("click",()=>{if(a.preview)URL.revokeObjectURL(a.preview);S.files=S.files.filter(x=>x!==a);renderItems();});btns.appendChild(remove);
 right.appendChild(btns);card.appendChild(right);
 right.addEventListener("input",ev=>{const x=ev.target.dataset.attr;if(!x)return;
   a[x]=x==="verified"?ev.target.checked:ev.target.value;
   if(x==="role")a.verified=false;
   updateStatus();
 });
 right.addEventListener("change",ev=>{const x=ev.target.dataset.attr;if(!x)return;
   a[x]=x==="verified"?ev.target.checked:ev.target.value;
   if(x==="role"){a.verified=false;renderItems();}else updateStatus();
 });
 return card;
}
function renderItems(){
 const box=$("cyexp-items");box.replaceChildren();
 if(!S.files.length){const p=document.createElement("p");p.textContent="尚未加入新案件圖片。新增格局圖為必填項目。";box.appendChild(p);}
 for(const [i,a]of S.files.entries())box.appendChild(itemBox(a,i));
 updateStatus();
}
function download(name,content){
 const blob=new Blob([content],{type:"application/json;charset=utf-8"});
 const url=URL.createObjectURL(blob);const a=document.createElement("a");
 a.href=url;a.download=name;document.body.appendChild(a);a.click();a.remove();
 setTimeout(()=>URL.revokeObjectURL(url),800);
}
function baseHtml(){
 const override=$("cyexp-newbase").value.trim();
 return override||pickBase()?.html_with_media||"";
}
function checks(){
 const base=pickBase(),floor=S.files.filter(x=>x.role==="格局圖");
 const urls=S.files.every(x=>validUrl(x.url));
 const unique=new Set(S.files.map(x=>x.url?.trim())).size===S.files.length;
 const alt=S.files.every(x=>x.alt?.trim()&&x.description?.trim()&&x.verified);
 const unit=$("cyexp-unit").value.trim();
 const project=chooseTitle();
 const pasted=$("cyexp-newbase").value.trim();
 const validatedBase=!!(base?.media_integrated&&base?.floorplan_protection_passed&&base?.preservation_audit?.original_main_content_preserved);
 const items=[];
 if(!project||!base)items.push("請選擇已有原文的建案");
 if(!unit)items.push("請填新案件／戶型名稱");
 if(!S.files.length)items.push("尚未選擇新案件圖片");
 if(!floor.length)items.push("缺少新的平面配置圖／格局圖");
 if(floor.length>1)items.push("目前有 "+floor.length+" 張新格局圖，請確認是否同一戶型（可保留多張）");
 if(!urls)items.push("新圖片尚未全部取得有效的晨陽官網 HTTPS 圖片網址");
 if(!unique)items.push("新圖片網址重複，請修正");
 if(!alt)items.push("圖片描述、ALT 或逐張人工核對尚未完成");
 if(!pasted&&!validatedBase)items.push("原文章媒體保留驗收不合格");
 if(!baseHtml())items.push("缺少完整原文章 HTML");
 if(!$("cyexp-intro").value.trim())items.push("尚未產生或確認新增案件的整體介紹");
 if(!$("cyexp-confirm-base").checked)items.push("尚未確認舊原文與格局圖完整且為最新");
 if(!$("cyexp-confirm-urls").checked)items.push("尚未確認正式圖片網址可實際開啟");
 if(!$("cyexp-confirm-floorplan").checked)items.push("尚未確認新格局圖對應戶別");
 const existing=baseHtml();
 for(const a of S.files){if(a.url&&existing.includes(a.url))items.push("新圖已存在於舊原文："+a.name);}
 const counted=(existing.match(/<img\b/gi)||[]).length;
 return {pass:items.length===0,issues:items,originalImageCount:counted,newImageCount:S.files.length,oldFloorplanCount:base?.floorplan_count||0,newFloorplanCount:floor.length};
}
function generate(){
 const base=baseHtml();
 if(!base)return "";
 const project=chooseTitle(),unit=$("cyexp-unit").value.trim(),kind=$("cyexp-type").value;
 let h="\n<hr>\n<section class=\"chenyang-case-addition\" data-append-version=\"1\">\n";
 h+="<h2>"+esc(project+"｜"+unit+" 空間規劃")+"</h2>\n";
 h+="<p>"+esc($("cyexp-intro").value.trim())+"</p>\n";
 const list=[...S.files].sort((a,b)=>(a.role==="格局圖"?-1:0)-(b.role==="格局圖"?-1:0));
 let zone="";
 for(const a of list){
   if(a.role!==zone){zone=a.role;h+="<h3>"+esc(zone==="格局圖"?unit+"｜平面配置圖":unit+"｜"+zone)+"</h3>\n";}
   const copy=a.description.trim()+"（"+(a.role==="格局圖"?"平面配置圖，請以最終核准圖說為準":kind+"，非施工完成證明")+"）";
   h+="<p>"+esc(copy)+"</p>\n";
   h+="<figure><img loading=\"lazy\" decoding=\"async\" src=\""+esc(a.url.trim())+"\" alt=\""+esc(a.alt.trim())+"\">";
   h+="<figcaption>"+esc(project+" "+unit+"｜"+zone+"｜"+(a.role==="格局圖"?"平面配置圖":kind))+"</figcaption></figure>\n";
 }
 h+="</section>\n";
 return base+"\n"+h;
}
function updateStatus(){
 const c=checks(),status=$("cyexp-status");
 status.className="cyexp-status "+(c.pass?"ready":"blocked");
 const headline=c.pass?"可上稿｜內容防錯驗收完成":"不可複製正式 HTML｜尚有 "+c.issues.length+" 項待完成";
 const count="舊圖 "+c.originalImageCount+" 張（原格局圖 "+c.oldFloorplanCount+" 張）＋新圖 "+c.newImageCount+" 張（新格局圖 "+c.newFloorplanCount+" 張）";
 status.replaceChildren();
 const b=document.createElement("strong");b.textContent=headline;status.appendChild(b);
 const p=document.createElement("p");p.textContent=count;status.appendChild(p);
 if(c.issues.length){const ul=document.createElement("ul");for(const i of c.issues){const li=document.createElement("li");li.textContent=i;ul.appendChild(li);}status.appendChild(ul);}
 $("cyexp-copy").disabled=!c.pass;
 $("cyexp-html").value=c.pass?generate():"驗收尚未完成，禁止輸出正式上稿 HTML。";
 $("cyexp-preview").replaceChildren();
 if(c.pass){
  const tag=document.createElement("p");tag.className="cyexp-muted";tag.textContent="新增 "+c.newImageCount+" 張圖片、其中新格局圖 "+c.newFloorplanCount+" 張；原 HTML 完整保留於最前方。";$("cyexp-preview").appendChild(tag);
 }
}
async function loadKnown(){
 try{
  const res=await fetch("./seo-known-visual-descriptions.json",{cache:"no-store"});if(!res.ok)throw Error("no match library");
  const data=await res.json();S.known=new Map((data.matched_images||[]).map(x=>[x.sha256,x]));
 }catch(_){S.known=new Map();}
}
async function addFiles(files){
 const fresh=[...files].filter(x=>x.type.startsWith("image/")).slice(0,50);
 if(!fresh.length)return;
 message("正在讀取圖片、比對已判讀的視覺內容……");
 let matched=0;
 for(const file of fresh){
  if(S.files.some(x=>x.sha256&&x.sha256===file._sha))continue;
  const a={name:file.name,file,preview:URL.createObjectURL(file),sha256:"",
    role:/(?:平面|格局|配置|floor.?plan)/i.test(file.name)?"格局圖":"其他",
    description:"",alt:"",altSuffix:"",url:"",verified:false,origin:"尚未由 AI 讀圖"};
  try{a.sha256=await identify(file);}catch(_){}
  if(S.files.some(x=>x.sha256&&x.sha256===a.sha256)){URL.revokeObjectURL(a.preview);continue;}
  if(enrichKnown(a))matched++;
  S.files.push(a);
 }
 renderItems();
 message("已加入 "+fresh.length+" 張圖片；其中 "+matched+" 張與本次已逐張辨識的 3D 示意圖完全相符。未知圖片請按「自動讀圖」。新格局圖仍需單獨加入並核對。");
}
async function initLocalModel(){
 if(S.pipeline)return S.pipeline;
 if(!navigator.gpu)throw Error("這台裝置未提供 WebGPU。可改用電腦 Chrome／Edge，或在 ChatGPT 上傳新圖取得讀圖文案後貼入；不會把檔名當作已讀圖。");
 message("正在從公開模型來源載入免費本機視覺模型；首次下載較大，圖片不送到第三方推論 API。");
 const mod=await import("https://cdn.jsdelivr.net/npm/@huggingface/transformers@3.8.1/+esm");
 S.pipeline=await mod.pipeline("image-text-to-text","HuggingFaceTB/SmolVLM-256M-Instruct",{device:"webgpu",dtype:"q4"});
 return S.pipeline;
}
function parseGenerated(res){
 const a=Array.isArray(res)?res[0]:res;
 let result=a?.generated_text??a?.text??"";
 if(Array.isArray(result))result=result.map(x=>x?.content||x?.text||"").join(" ");
 return String(result).trim().replace(/^assistant\s*:\s*/i,"").slice(0,550);
}
async function readImages(){
 if(S.modelBusy)return;
 const todo=S.files.filter(x=>!x.description?.trim());
 if(!todo.length){
  for(const a of S.files)if(!a.alt&&a.description){a.alt=makeAlt(a);a.verified=false;}
  renderItems();message("目前圖片都有描述草稿。請新增尚未加入的格局圖，並逐張核對 ALT。");return;
 }
 S.modelBusy=true;$("cyexp-read").disabled=true;
 try{
  const pipe=await initLocalModel();
  for(let i=0;i<todo.length;i++){
   const a=todo[i];if(!a.file){message("匯入舊草稿但未重新選圖片，無法讀圖："+a.name,true);continue;}
   message("本機 AI 讀圖 "+(i+1)+"/"+todo.length+"："+a.name);
   const messages=[{role:"user",content:[
    {type:"image",image:a.preview},
    {type:"text",text:"Describe the visible interior architecture and furniture in this image in Traditional Chinese. Mention only things that are actually visible, such as layout, cabinets, bed, windows, materials. Do not invent dimensions, floor plan unit code, completion status, or a real homeowner. Maximum 80 Chinese characters."}
   ]}];
   const out=await pipe(messages,{max_new_tokens:120,return_full_text:false});
   const result=parseGenerated(out);
   if(!result)throw Error("模型未輸出可用描述，請人工核對");
   a.description=result;a.origin="瀏覽器本機視覺模型草稿｜尚待人工核對";
   if(a.role==="其他"&&/格局|平面圖|floor.?plan/i.test(result))a.role="格局圖";
   a.alt=makeAlt(a);a.verified=false;
   renderItems();
  }
  message("讀圖草稿已產生；請逐張核對畫面內容、ALT 和戶型。AI 說明不是已驗證事實。");
 }catch(e){message("本機 AI 讀圖未完成："+(e?.message||"裝置或模型限制")+"。請在支援 WebGPU 的電腦重試，或將圖片交給 ChatGPT 讀圖後貼回欄位。",true);}
 finally{S.modelBusy=false;$("cyexp-read").disabled=false;updateStatus();}
}
function generateSummary(){
 const descriptions=S.files.filter(x=>x.role!=="格局圖"&&x.description.trim()).map(x=>x.description.trim());
 if(!descriptions.length){message("沒有可用的圖片描述，請先讀圖再產生整體介紹。",true);return;}
 const project=chooseTitle(),unit=$("cyexp-unit").value.trim()||"新增案件",kind=$("cyexp-type").value;
 const unique=[...new Set(S.files.filter(x=>x.role!=="格局圖").map(x=>x.role).filter(x=>x!=="其他"))];
 const highlights=unique.length?unique.slice(0,6).join("、"):"空間規劃";
 $("cyexp-intro").value=project+"新增 "+unit+" 方案，以"+highlights+"的設計提案呈現空間安排。本專區使用"+kind+"說明配置與收納方向，實際尺寸、材質及工程成果仍須以核准圖說與現場確認為準。";
 updateStatus();
}
function exportDraft(){
 const base=pickBase();
 const safe={
  version:1,project_id:base?.id||"",unit:$("cyexp-unit").value,type:$("cyexp-type").value,
  intro:$("cyexp-intro").value,items:S.files.map(({name,sha256,role,description,alt,url,verified,origin})=>({name,sha256,role,description,alt,url,verified,origin})),
  note:"僅儲存文字／照片雜湊及正式圖片網址，不包含原始照片、現有 CMS HTML、任何 API 密鑰"
 };
 download("chenyang-new-case-draft-"+(base?.id||"unknown")+".json",JSON.stringify(safe,null,2));
}
async function importDraft(file){
 let data;try{data=JSON.parse(await file.text());}catch(_){message("草稿 JSON 格式錯誤",true);return;}
 if(data?.version!==1||!Array.isArray(data.items)||data.items.length>50){message("草稿版本或圖片數量不符合規範",true);return;}
 const project=S.base.find(x=>x.id===data.project_id);if(project)$("cyexp-base").value=project.id;
 $("cyexp-unit").value=String(data.unit||"").slice(0,90);$("cyexp-type").value=data.type==="實景照片"?"實景照片":"3D 建模示意圖";
 $("cyexp-intro").value=String(data.intro||"").slice(0,2000);
 for(const a of S.files)if(a.preview)URL.revokeObjectURL(a.preview);
 S.files=data.items.map(x=>({
  name:String(x.name||"").slice(0,150),sha256:String(x.sha256||""),
  role:zones.includes(x.role)?x.role:"其他",
  description:String(x.description||"").slice(0,1500),
  alt:String(x.alt||"").slice(0,260),url:String(x.url||"").slice(0,1200),
  verified:false,origin:"已從草稿恢復；需重新人工核對",preview:null,file:null
 }));
 $("cyexp-confirm-base").checked=false;$("cyexp-confirm-urls").checked=false;$("cyexp-confirm-floorplan").checked=false;
 renderItems();message("草稿已讀取，但照片本體未包含於 JSON，請重新上傳核對；所有完成勾選已重設。");
}
async function start(){
 const out=await Promise.allSettled([
  fetch("./seo-media-rewrites.json",{cache:"no-store"}).then(r=>r.json()),
  fetch("./seo-rewrites.json",{cache:"no-store"}).then(r=>r.json()),
  loadKnown()
 ]);
 if(out[0].status!=="fulfilled"||out[1].status!=="fulfilled"){
  message("無法載入舊文章與改稿；禁止以空原文產生可上稿 HTML。",true);return;
 }
 S.base=(out[0].value.articles||[]).filter(x=>x.html_with_media);
 S.drafts=out[1].value.articles||[];
 const sel=$("cyexp-base");sel.replaceChildren();
 for(const item of S.base){
  const dr=S.drafts.find(x=>x.id===item.id);
  const op=document.createElement("option");op.value=item.id;
  op.textContent=(dr?.project_name||dr?.title||item.id).split("｜",1)[0];sel.appendChild(op);
 }
 const def=S.base.find(x=>x.id==="seo-danfo-234");
 if(def)sel.value=def.id;updateStatus();
 message("已載入 "+S.base.length+" 篇原文章及本次 9 張示意圖的已核對辨識範本；尚未上傳任何新圖片。");
}
$("cyexp-files").addEventListener("change",ev=>{addFiles(ev.target.files||[]);ev.target.value="";});
$("cyexp-read").addEventListener("click",readImages);
$("cyexp-summary").addEventListener("click",generateSummary);
$("cyexp-export").addEventListener("click",exportDraft);
$("cyexp-import").addEventListener("change",ev=>{if(ev.target.files[0])importDraft(ev.target.files[0]);ev.target.value="";});
$("cyexp-copy").addEventListener("click",async()=>{
 const c=checks();if(!c.pass){updateStatus();return;}
 try{await navigator.clipboard.writeText(generate());message("已複製：原文＋所有原格局圖＋新增案件＋新格局圖。正式上稿前請在 CMS 預覽再次核對。");}
 catch(_){message("瀏覽器複製失敗，請在下方 HTML 原始碼欄手動複製。",true);}
});
for(const id of ["cyexp-base","cyexp-unit","cyexp-type","cyexp-intro","cyexp-newbase","cyexp-confirm-base","cyexp-confirm-urls","cyexp-confirm-floorplan"]){
 $(id).addEventListener("input",updateStatus);$(id).addEventListener("change",updateStatus);
}
start();
})();