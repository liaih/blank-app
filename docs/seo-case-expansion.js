/* 晨陽：同建案新增戶型。靜態站、本機圖片，不回傳原始圖給本站伺服器。 */
(function(){
"use strict";
const host=document.getElementById("case-expansion");
if(!host)return;
const $=id=>host.querySelector("#"+id);
const esc=s=>String(s??"").replace(/[&<>"']/g,ch=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[ch]));
const zones=["格局圖","玄關與客廳","玄關","客廳","客餐廳","廚房與走道","多功能工作區","臥室","更衣收納","其他"];
const S={base:[],drafts:[],known:new Map(),files:[],pipeline:null,translator:null,transformers:null,modelBusy:false,visionReady:false,verifiedBase:false,localConnected:false,localModel:""};
const markup=[
'<div class="cyexp-head"><h3>同建案新增案件｜AI 讀圖＋ALT＋格局圖</h3>',
'<p class="cyexp-muted">原文章＋舊戶型全部保留。新增圖片在本機辨識；圖片須先上傳晨陽官網取得正式網址，才可輸出正式 HTML。</p></div>',
'<div class="cyexp-fields">',
'<label>原建案文章<select id="cyexp-base"><option value="">正在載入原文章</option></select></label>',
'<label>新增案件內部識別（必填，不會寫入公開標題或 ALT）<input id="cyexp-unit" placeholder="例如：第二組設計提案／專案編號，僅供管理"></label>',
'<label>素材類型<select id="cyexp-type"><option value="3D 建模示意圖">3D 建模示意圖（未完工）</option><option value="實景照片">真實完工照片（需確認確實完工）</option></select></label>',
'</div>',
'<label>新增案件整體介紹（可以自動產生後編輯）<textarea id="cyexp-intro" rows="3" placeholder="由已讀取的圖片描述組合，請核對。不可把 3D 示意圖稱為完工實景。"></textarea></label>',
'<div class="cyexp-actions"><label class="cyexp-file">選擇新案件圖片（可一次選多張）<input id="cyexp-files" type="file" accept="image/png,image/jpeg,image/webp,image/avif" multiple></label>',
'<button type="button" id="cyexp-read">免費備援小模型讀圖（品質有限）</button>',
'<button type="button" id="cyexp-summary">依讀圖結果整理案件總覽</button></div>',
'<details class="cyexp-advanced" id="cyexp-cms-import-panel" open><summary>最快流程｜貼入官網編輯器圖片 HTML，自動辨識並配對全部網址</summary>',
'<p class="cyexp-muted">在晨陽官網編輯器將這次新增的圖片「一次批次上傳」，複製該批圖片的 HTML 貼到下面；系統會自動讀取所有 img src，依檔名配對，無法辨識時只在圖片數完全相同的情況下依順序配對。**不用逐張貼網址。** 上傳與儲存仍需在公司 CMS 完成。</p>',
'<textarea id="cyexp-cms-html" rows="5" placeholder="貼上官網編輯器圖片 HTML，例如：&lt;p&gt;&lt;img src=&quot;https://chen-yang.com.tw/upload/images/1.0.png&quot;&gt;&lt;/p&gt; ..."></textarea>',
'<div class="cyexp-actions"><button type="button" id="cyexp-match-cms">自動讀取官網 HTML 並配對圖片</button>',
'<button type="button" id="cyexp-paste-cms">直接讀取剪貼簿的 HTML／文字</button></div>',
'<p id="cyexp-cms-match-status" role="status" class="cyexp-muted">尚未讀取官網已上傳的圖片。AI 說明及 ALT 可以先產生，正式可上稿 HTML 須有實際圖片網址。</p></details>',
'<details class="cyexp-advanced"><summary>快速上稿｜批次貼入所有圖片網址（免逐張輸入）</summary>',
'<p class="cyexp-muted">先依目前圖片順序貼入一行一個正式圖片網址；或貼入「圖片檔名 | 官網網址」來自動配對，包含新格局圖。僅接受晨陽官網 HTTPS 圖片網址。</p>',
'<textarea id="cyexp-bulk-urls" rows="4" placeholder="https://chen-yang.com.tw/upload/images/新案-01.png&#10;https://chen-yang.com.tw/upload/images/新案-02.png"></textarea>',
'<button type="button" id="cyexp-apply-urls">批次套用圖片網址</button></details>',
'<details class="cyexp-advanced" id="cyexp-local-ai"><summary>連接我的本機 AI｜LM Studio 圖像辨識（推薦）</summary>',
'<p class="cyexp-muted">僅連接此電腦的 127.0.0.1:1234，不會將圖片上傳到 GitHub。請先在 LM Studio 載入有看圖能力的模型（例如已安裝的 Qwen3-VL），啟動本機伺服器、開啟 CORS，建議啟用身分驗證並只綁定本機。Chrome 若詢問本機網路存取權限，需自行決定是否允許。</p>',
'<div class="cyexp-fields"><label>LM Studio 圖像模型<select id="cyexp-local-model" disabled><option value="">先按測試連線</option></select></label>',
'<label>LM Studio 本機 API Token（如已啟用身分驗證）<input id="cyexp-local-token" type="password" autocomplete="off" placeholder="僅在目前瀏覽器使用，不會儲存"></label></div>',
'<div class="cyexp-actions"><button type="button" id="cyexp-connect">測試本機 AI 連線／讀取模型</button>',
'<button type="button" id="cyexp-local-read" disabled>用本機 AI 重新讀取全部新圖片</button></div>',
'<p id="cyexp-local-status" role="status" class="cyexp-muted">尚未連接。現有小模型的粗略翻譯不適合直接上稿。</p>',
'<div class="cyexp-advanced"><p class="cyexp-muted"><strong>連不上時請依序排查：</strong>① 在 LM Studio → Developer 按 Start Server，確認 Port 1234；② 在 Server Settings 開啟 Enable CORS，保持 Serve on Local Network 關閉；③ 點下方「直接檢查本機 API」並確認回傳模型 JSON（若要求驗證可能顯示 401）；④ 回來按「測試本機 AI 連線」，並允許 Chrome 的本機網路權限。切勿關閉瀏覽器安全保護。</p>',
'<div class="cyexp-actions"><a id="cyexp-local-check-url" href="http://127.0.0.1:1234/v1/models" target="_blank" rel="noopener noreferrer">直接檢查本機 API（另開分頁）</a>',
'<button type="button" id="cyexp-copy-start">複製 LM Studio 啟動指令（PowerShell）</button></div>',
'<p class="cyexp-muted">建議 PowerShell 指令：<code>lms server start --port 1234 --bind 127.0.0.1 --cors</code>。若 LM Studio 已由圖形介面啟動，不必再開第二個 Server。啟用 CORS 時建議開啟 API 身分驗證。</p></div>',
'<p class="cyexp-muted">每張圖會個別送到你電腦的本機模型；不會寫入任何雲端 API 金鑰。讀圖產物仍需人工核對，格局圖不會由 AI 自動宣告驗收通過。</p></details>',
'<p class="cyexp-muted">本次丹佛花都 9 張原始示意圖有既有人工辨識範本；其他新圖改用 Transformers.js 官方支援的 image-to-text 讀圖模型，再以本機英文轉中文模型翻譯。首次須下載模型，通常使用 CPU 也能執行，不強制 WebGPU。圖片不送往付費 AI API；描述僅是草稿，需人工核對，格局圖需確認圖面。</p>',
'<p id="cyexp-vision-status" class="cyexp-muted" role="status"></p>',
'<div id="cyexp-items" class="cyexp-images"><p>請選擇新案件圖片；包含新平面配置圖／格局圖。</p></div>',
'<div class="cyexp-actions"><button type="button" id="cyexp-approve-reviewed">我已看過本批圖片，一次核對全部描述與 ALT</button></div>',
'<p class="cyexp-muted">此按鈕只代替逐張重複勾選；不會替你確認圖片是否已上傳官網，也不會跳過新增格局圖及原文保護檢查。</p>',
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
 // 晨陽圖片 ALT：建案名稱＋可核對的地區／實際畫面＋晨陽設計；
 // 25–45字是編輯參考，不堆疊關鍵字，不把3D示意圖寫成完工照。
 // 戶型／新案件內部識別不自動放入 ALT。
 const project=chooseTitle();
 const region={
  "seo-danfo-234":"林口A7","seo-yunjiang-331":"林口A7",
  "seo-hongguang-253":"林口A7","seo-fumei-503":"新莊頭前",
  "seo-lixuan-217":"林口","seo-housheng-451":"中壢A20",
  "ai-kaohsiung-536":"高雄仁武"
 }[pickBase()?.id]||"";
 const where=region?region+" ":"";
 const kind=$("cyexp-type").value;
 const detail=String(a.altSuffix||a.description||a.role||"室內空間")
   .replace(/[\r\n]+/g," ")
   .replace(/[｜|]+/g,"、")
   .trim();
 if(a.role==="格局圖"){
   // 不推測房數、坪數、代碼；如有多個方案，人工以圖面確實差異區分。
   const specific=(detail==="格局圖"||detail==="平面配置圖")?
     "住宅室內格局與空間動線規劃":detail.slice(0,25);
   return project+"｜"+where+"平面配置圖、"+specific+"｜晨陽設計";
 }
 const visible=detail.slice(0,40);
 return project+"｜"+where+visible+"｜"+kind+"｜晨陽設計";
}
function hammingHex(a,b){
 if(!/^[a-f0-9]{16}$/i.test(a||"")||!/^[a-f0-9]{16}$/i.test(b||""))return 65;
 let distance=0;
 for(let k=0;k<16;k++){
  let v=parseInt(a[k],16)^parseInt(b[k],16);
  while(v){distance+=v&1;v>>=1;}
 }
 return distance;
}
async function imageDhash(file){
 if(typeof createImageBitmap!=="function")return "";
 const image=await createImageBitmap(file);
 try{
  const canvas=document.createElement("canvas");canvas.width=9;canvas.height=8;
  const ctx=canvas.getContext("2d",{willReadFrequently:true});
  if(!ctx)return "";
  ctx.imageSmoothingEnabled=true;ctx.imageSmoothingQuality="high";
  ctx.drawImage(image,0,0,9,8);
  const px=ctx.getImageData(0,0,9,8).data;
  const grey=(x,y)=>{
   const k=4*(y*9+x);
   return px[k]*0.299+px[k+1]*0.587+px[k+2]*0.114;
  };
  let bits="";
  for(let y=0;y<8;y++)for(let x=0;x<8;x++)bits+=grey(x,y)>grey(x+1,y)?"1":"0";
  let output="";for(let i=0;i<64;i+=4)output+=parseInt(bits.slice(i,i+4),2).toString(16);
  return output;
 }finally{image.close?.();}
}
async function enrichKnown(a){
 let known=S.known.get(a.sha256),method="完全相同的原始圖片";
 if(!known&&a.file){
  // A 64-bit difference-hash recognizes known images when users upload
  // resized/compressed copies. Reject near ties and weak matches; do NOT
  // infer the meaning of unrelated images from hash proximity.
  let hash="";
  try{hash=await imageDhash(a.file);}catch(_){}
  if(hash){
   const ranked=[...S.known.values()].filter(x=>x.dhash_v1)
       .map(x=>({item:x,diff:hammingHex(hash,x.dhash_v1)}))
       .sort((x,y)=>x.diff-y.diff);
   if(ranked[0]?.diff<=7&&(!ranked[1]||ranked[1].diff-ranked[0].diff>=6)){
    known=ranked[0].item;method="圖片像素相似度比對（可能有誤，請核對）";
   }
  }
 }
 if(!known)return false;
 a.role=known.zone;a.description=known.description;a.altSuffix=known.alt_suffix;
 a.alt=makeAlt(a);a.autoAlt=a.alt;a.origin="已判讀的丹佛花都參考圖："+method+"；描述仍需人工核對";
 a.verified=false;return true;
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
 right.appendChild(textField("圖片 ALT（建案與畫面優先，不強制寫戶型）",a.alt,"alt",false));
 const urlBox=document.createElement("details");urlBox.className="cyexp-advanced";
 const urlSummary=document.createElement("summary");
 urlSummary.textContent=validUrl(a.url)?"官網圖片：已取得正式網址（點此查看／修改）":"官網圖片：尚待批次配對（點此手動修改）";
 urlBox.appendChild(urlSummary);
 urlBox.appendChild(textField("晨陽官網圖片網址（通常不必逐張輸入）",a.url,"url",false));
 right.appendChild(urlBox);
 if(validUrl(a.url)){
  const link=document.createElement("a");
  link.href=a.url;link.target="_blank";link.rel="noopener noreferrer";link.className="cyexp-muted";
  link.textContent="查看上傳後官網圖片"+(a.urlMatch?"｜"+a.urlMatch:"");
  right.appendChild(link);
 }
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
   if(x==="url")urlSummary.textContent=validUrl(a.url)?"官網圖片：已取得正式網址（點此查看／修改）":"官網圖片：尚待批次配對（點此手動修改）";
   updateStatus();
 });
 right.addEventListener("change",ev=>{const x=ev.target.dataset.attr;if(!x)return;
   const wasAuto=!!(a.autoAlt&&a.alt===a.autoAlt);
   a[x]=x==="verified"?ev.target.checked:ev.target.value;
   if(x==="alt"){a.autoAlt="";a.verified=false;updateStatus();return;}
   if(x==="role"||x==="description"){
     if(!a.alt?.trim()||wasAuto){a.alt=makeAlt(a);a.autoAlt=a.alt;}
     a.verified=false;renderItems();return;
   }
   updateStatus();
 });
 return card;
}
function approveReviewedBatch(){
 if(!S.files.length){message("尚未加入圖片，無法批次核對。",true);return;}
 const incomplete=S.files.filter(x=>!x.description?.trim()||!x.alt?.trim()||!zones.includes(x.role));
 if(incomplete.length){message("還有 "+incomplete.length+" 張圖片缺少描述或 ALT，不能直接整批確認。請先使用本機 Qwen3-VL 讀圖或修正。",true);return;}
 for(const a of S.files)a.verified=true;
 renderItems();
 message("已核對本批 "+S.files.length+" 張圖片的描述與 ALT。下一步仍需核對正式圖片網址、包含新格局圖，以及保留原文章。");
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
 if(!unit)items.push("請填新增案件的內部識別名稱");
 if(!S.files.length)items.push("尚未選擇新案件圖片");
 if(!floor.length)items.push("缺少新的平面配置圖／格局圖");

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
 h+="<h2>"+esc(project+"｜室內設計新提案與空間收納規劃")+"</h2>\n";
 h+="<p>"+esc($("cyexp-intro").value.trim())+"</p>\n";
 const list=[...S.files].sort((a,b)=>(a.role==="格局圖"?-1:0)-(b.role==="格局圖"?-1:0));
 let zone="";
 for(const a of list){
   if(a.role!==zone){zone=a.role;h+="<h3>"+esc(zone==="格局圖"?project+"｜平面配置與空間動線":zone+"｜空間設計重點")+"</h3>\n";}
   const copy=a.description.trim()+"（"+(a.role==="格局圖"?"平面配置圖，請以最終核准圖說為準":kind+"，非施工完成證明")+"）";
   h+="<p>"+esc(copy)+"</p>\n";
   h+="<figure><img loading=\"lazy\" decoding=\"async\" src=\""+esc(a.url.trim())+"\" alt=\""+esc(a.alt.trim())+"\">";
   h+="<figcaption>"+esc(project+"｜"+zone+"｜"+(a.role==="格局圖"?"平面配置圖":kind))+"</figcaption></figure>\n";
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
  const frame=document.createElement("iframe");
  frame.setAttribute("sandbox","");frame.title="原文及新增案件完整 HTML 預覽";
  frame.style.cssText="width:100%;max-width:100%;height:480px;border:1px solid #d6dfe8;border-radius:10px;background:white";
  frame.srcdoc='<!doctype html><html lang="zh-Hant"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">'+
    '<style>html,body{max-width:100%;overflow-x:hidden;font:16px/1.8 sans-serif;color:#293645}body{padding:12px;margin:0}img{max-width:100%;height:auto;display:block;margin:10px auto}h2{font-size:22px}h3{font-size:18px}figure{margin:14px 0}figcaption{text-align:center;font-size:13px;color:#64748b}</style></head><body>'+
    generate()+'</body></html>';
  $("cyexp-preview").appendChild(frame);
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
  if(await enrichKnown(a))matched++;
  S.files.push(a);
 }
 renderItems();
 message("已加入 "+fresh.length+" 張圖片；其中 "+matched+" 張比對到已判讀的 3D 示意圖（含可能縮放／壓縮版本，仍需核對畫面）。未識別圖片按「自動讀圖」，新格局圖需單獨加入並核對。");
}

const LMSTUDIO_BASE="http://127.0.0.1:1234";
function localAuthHeaders(json=false){
 const h={};if(json)h["Content-Type"]="application/json";
 const t=$("cyexp-local-token").value.trim();if(t)h.Authorization="Bearer "+t;
 return h;
}
function localStatus(txt,err=false){
 $("cyexp-local-status").textContent=txt;
 $("cyexp-local-status").style.color=err?"#b91c1c":"";
}
function localError(e){
 const hints="請先在瀏覽器另開 http://127.0.0.1:1234/v1/models 確認伺服器可回應；接著在 LM Studio Developer 檢查 Server Port=1234、Server Running、Enable CORS、Serve on Local Network=關閉。若 Chrome 跳出本機網路／回送位址權限，請允許這個你信任的網站。";
 if(e?.name==="TypeError")return "連線被阻擋：可能是 LM Studio 沒啟動、CORS 未開、瀏覽器未授權存取本機網路，或 HTTPS→HTTP 本機連線限制。"+hints;
 return String(e?.message||"連線失敗")+"。"+hints;
}
async function connectLocalAI(){
 if(S.modelBusy)return;
 const btn=$("cyexp-connect");btn.disabled=true;
 S.localConnected=false;$("cyexp-local-read").disabled=true;
 localStatus("正在連接本機 LM Studio 127.0.0.1:1234……");
 try{
  const resp=await fetch(LMSTUDIO_BASE+"/v1/models",{
    method:"GET",headers:localAuthHeaders(),mode:"cors",cache:"no-store",
    targetAddressSpace:"loopback"
  });
  if(!resp.ok)throw Error("LM Studio HTTP "+resp.status+(resp.status===401?"：請輸入本機 API Token":""));
  const d=await resp.json(), models=Array.isArray(d.data)?d.data:[];
  if(!models.length)throw Error("已連接但沒有模型。請先在 LM Studio 載入可看圖的模型");
  const select=$("cyexp-local-model");select.replaceChildren();
  const priority=models.filter(x=>/qwen.*vl|llava|vision|pixtral|internvl/i.test(x.id||""));
  for(const m of [...priority,...models.filter(x=>!priority.includes(x))]){
    if(!m.id)continue;
    const op=document.createElement("option");op.value=m.id;op.textContent=m.id;select.appendChild(op);
  }
  S.localConnected=true;S.localModel=select.value;select.disabled=false;
  $("cyexp-local-read").disabled=false;
  $("cyexp-read").textContent="使用已連接的本機 AI 讀圖";
  localStatus("本機連線成功，共 "+models.length+" 個模型。選擇已載入的視覺模型後按「用本機 AI 重新讀取全部」。連線不等於讀圖測試通過。");
 }catch(e){S.localConnected=false;$("cyexp-local-model").disabled=true;$("cyexp-read").textContent="免費備援小模型讀圖（品質有限）";localStatus(localError(e),true);}
 finally{btn.disabled=false;}
}
function fileAsDataUrl(file){
 if(!file||!/^image\/(png|jpeg|webp|avif)$/i.test(file.type))throw Error("僅支援 JPG、PNG、WebP、AVIF 圖片");
 if(file.size>18*1024*1024)throw Error("圖片超過18MB，請用縮小副本進行讀圖；正式上稿仍可用原圖");
 return new Promise((resolve,reject)=>{
  const reader=new FileReader();
  reader.onload=()=>resolve(reader.result);
  reader.onerror=()=>reject(Error("讀取本機圖片失敗"));
  reader.readAsDataURL(file);
 });
}
function parseLocalVision(s){
 if(typeof s!=="string")throw Error("模型沒有回傳文字");
 let raw=s.replace(/^\x60{3}(?:json)?\s*/i,"").replace(/\s*\x60{3}$/,"").trim();
 const a=raw.indexOf("{"),b=raw.lastIndexOf("}");
 if(a<0||b<=a)throw Error("模型沒有提供 JSON 圖片描述；請改用已載入的 Qwen3-VL");
 let d;try{d=JSON.parse(raw.slice(a,b+1));}catch(_){throw Error("模型輸出的圖片資料不是合法 JSON");}
 if(typeof d?.description!=="string"||d.description.trim().length<12)throw Error("圖片說明不足或無法辨識");
 const roles=["格局圖","玄關與客廳","玄關","客廳","客餐廳","廚房與走道","多功能工作區","臥室","更衣收納","其他"];
 return {description:d.description.trim().slice(0,450),role:roles.includes(d.space)?d.space:"其他"};
}
async function localVisionOne(file,model){
 const data=await fileAsDataUrl(file);
 const prompt=[
  "請直接觀察這張室內設計圖像，僅描述畫面確實可見的家具、空間、木作、燈光與收納，不得捏造戶別、坪數、工程完成情況、業主身分。",
  "請使用台灣繁體中文，描述 45-100 個中文字，3D 示意圖不能說成實景。",
  "回覆只能是一個JSON物件，不要markdown：",
  '{"space":"客廳","description":"此空間看得到的具體家具、櫃體、配置與材質描述"}',
  "space 限：格局圖、玄關與客廳、玄關、客廳、客餐廳、廚房與走道、多功能工作區、臥室、更衣收納、其他。",
  "不要猜測畫面中不存在的電視或家具，也不要虛構戶型。"
 ].join("\n");
 const req={model,temperature:0.1,max_tokens:400,stream:false,messages:[
  {role:"system",content:"你是台灣室內設計影像編輯，僅敘述圖片中能辨識的事實，嚴格輸出JSON。"},
  {role:"user",content:[{type:"text",text:prompt},{type:"image_url",image_url:{url:data}}]}
 ]};
 const ctrl=new AbortController();
 const timer=setTimeout(()=>ctrl.abort(),240000);
 try{
  const resp=await fetch(LMSTUDIO_BASE+"/v1/chat/completions",{
   method:"POST",headers:localAuthHeaders(true),mode:"cors",signal:ctrl.signal,
   targetAddressSpace:"loopback",body:JSON.stringify(req)
  });
  if(!resp.ok)throw Error("LM Studio 回應 HTTP "+resp.status+"："+(await resp.text()).slice(0,160));
  const json=await resp.json();
  const value=json?.choices?.[0]?.message?.content;
  const output=typeof value==="string"?value:Array.isArray(value)?value.filter(x=>x.type==="text").map(x=>x.text||"").join("\n"):"";
  return parseLocalVision(output);
 }finally{clearTimeout(timer);}
}
async function readWithLocalAI(){
 if(S.modelBusy)return;
 if(!S.localConnected){localStatus("請先按「測試本機 AI 連線」。",true);return;}
 const model=$("cyexp-local-model").value;
 if(!model){localStatus("請先選擇本機看圖模型。",true);return;}
 if(!S.files.length){localStatus("請先選擇要讀圖的圖片。",true);return;}
 S.modelBusy=true;$("cyexp-local-read").disabled=true;$("cyexp-read").disabled=true;
 let done=0,fail=0;
 try{
  for(let i=0;i<S.files.length;i++){
   const a=S.files[i];
   if(!a.file){fail++;localStatus("第 "+(i+1)+" 張未重新選圖，無法讀取。",true);continue;}
   localStatus("本機 AI 正在讀第 "+(i+1)+" / "+S.files.length+" 張："+a.name);
   try{
    const found=await localVisionOne(a.file,model);
    const manuallyEdited=!!(a.alt&&(!a.autoAlt||a.alt!==a.autoAlt));
    a.description=found.description;
    // Image models can confuse plans and renders: never automatically approve a new floorplan.
    if(a.role!=="格局圖"&&found.role!=="格局圖")a.role=found.role;
    if(!manuallyEdited){a.alt=makeAlt(a);a.autoAlt=a.alt;}
    a.origin="LM Studio 本機視覺模型 "+model+" 的草稿，仍須人工核對";
    a.verified=false;done++;
   }catch(e){fail++;a.verified=false;localStatus("第 "+(i+1)+" 張出錯："+(e?.message||"讀圖失敗"),true);}
   renderItems();
  }
  if(done>0&&!$("cyexp-intro").value.trim())generateSummary();
  localStatus("本機讀圖完成："+done+" 張有新描述，"+fail+" 張失敗。已在缺少總覽時自動產生初稿；請核對並可按「一次核對全部描述與 ALT」。新增格局圖與圖片網址仍須驗收。",fail>0);
 }finally{
  S.modelBusy=false;$("cyexp-local-read").disabled=!S.localConnected;
  $("cyexp-read").disabled=false;updateStatus();
 }
}
async function initLocalModel(){
 if(S.pipeline)return S.pipeline;
 message("正在下載本機圖片描述模型 Xenova/vit-gpt2-image-captioning（image-to-text）。首次下載需要網路與瀏覽器快取空間，不依賴 WebGPU。");
 const mod=await import("https://cdn.jsdelivr.net/npm/@huggingface/transformers@3.8.1/+esm");
 if(typeof mod.pipeline!=="function")throw Error("Transformers.js 模型載入介面無法使用");
 S.transformers=mod;
 // Transformers.js v3.8.1 exposes image-to-text, not image-text-to-text.
 // Default CPU/WASM backend is deliberately used for broad device support.
 S.pipeline=await mod.pipeline("image-to-text","Xenova/vit-gpt2-image-captioning");
 return S.pipeline;
}
async function translateToChinese(caption){
 if(!S.transformers)throw Error("圖片模型尚未初始化");
 if(!S.translator){
  message("已取得英文圖片描述，正在載入免費英文轉中文模型（首次下載需時間）。");
  S.translator=await S.transformers.pipeline("translation","Xenova/opus-mt-en-zh");
 }
 const output=await S.translator(caption,{max_new_tokens:100});
 const item=Array.isArray(output)?output[0]:output;
 const result=String(item?.translation_text||item?.generated_text||"").trim();
 if(!result)throw Error("翻譯模型未回傳可用的中文內容");
 try{
  // English-to-zh model can emit Simplified Chinese. Convert to Taiwan
  // Traditional Chinese when the lightweight converter is available.
  const cc=await import("https://cdn.jsdelivr.net/npm/opencc-js@1.4.2/dist/esm/full.js");
  const factory=cc.default?.Converter||cc.Converter;
  return factory({from:"cn",to:"twp"})(result);
 }catch(_){
  // Do not hide failed language conversion; editor still must verify.
  message("中文翻譯完成，但台灣繁體轉換套件未載入，請核對字形與用詞。");
  return result;
 }
}
function parseGenerated(res){
 const a=Array.isArray(res)?res[0]:res;
 let result=a?.generated_text??a?.text??"";
 if(Array.isArray(result))result=result.map(x=>x?.content||x?.text||"").join(" ");
 return String(result).trim().replace(/^assistant\s*:\s*/i,"").slice(0,550);
}
async function readImages(){
 if(S.localConnected)return readWithLocalAI();
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
   // ImageToTextPipeline expects an image URL/blob URL, NOT chat message arrays.
   const out=await pipe(a.preview,{max_new_tokens:70});
   const caption=parseGenerated(out);
   if(!caption)throw Error("圖片描述模型未輸出內容");
   let result="";
   try{
    result=await translateToChinese(caption);
    a.origin="圖片描述模型＋英文轉中文模型產生的草稿；需人工核對，非完工證明";
   }catch(translationError){
    // Keep the observed caption, not a fabricated Chinese claim.
    result=caption;
    a.origin="已完成圖片辨識，但中文翻譯失敗；目前顯示英文描述，請人工改寫中文後再確認 ALT";
    message("圖片已辨識但翻譯未完成："+(translationError?.message||"未知原因")+"；英文內容可以人工編輯。",true);
   }
   a.captionEn=caption;
   a.description=result;
   // A caption model cannot reliably distinguish a plan from a 3D render.
   // The floorplan status is only accepted after manual selection/verification.
   a.alt=makeAlt(a);a.autoAlt=a.alt;a.verified=false;
   renderItems();
  }
  message("已使用相容的 image-to-text 模型產生圖片描述；請核對中文、ALT、3D 示意圖身分及新格局圖。模型可能描述錯誤，確認後才能複製 HTML。");
 }catch(e){message("本機圖片辨識未完成："+(e?.message||"模型下載／執行失敗")+"。可換用桌面 Chrome／Edge 重新開啟，或將圖片交給 ChatGPT 讀圖後，把繁中描述貼回欄位；不會假裝模型已成功。",true);}
 finally{S.modelBusy=false;$("cyexp-read").disabled=false;updateStatus();}
}
function refreshAutoAlts(){
 for(const a of S.files){
  if(a.autoAlt&&a.alt===a.autoAlt){
   const updated=makeAlt(a);if(updated!==a.alt){a.alt=updated;a.autoAlt=updated;a.verified=false;}
  }
 }
 renderItems();
}
function officialCmsUrl(candidate){
 if(typeof candidate!=="string"||!candidate.trim())return "";
 try{
  const url=new URL(candidate.trim().replace(/&amp;/g,"&"),"https://chen-yang.com.tw/");
  if(!validUrl(url.href))return "";
  url.hash="";
  return url.href;
 }catch(_){return "";}
}
function extractCmsImageUrls(raw){
 // DOMParser does not execute scripts. Only image source attributes are read;
 // pasted HTML is never inserted into our page or sent to a server.
 const text=String(raw||"").trim();
 if(!text)return [];
 const urls=[];
 const push=address=>{
  const url=officialCmsUrl(address);
  if(url&&!urls.includes(url))urls.push(url);
 };
 if(/<img[\s>]/i.test(text)){
  const parsed=new DOMParser().parseFromString(text,"text/html");
  for(const img of parsed.querySelectorAll("img")){
   for(const attr of ["data-original","data-src","data-lazy-src","src"]){
    const src=img.getAttribute(attr);
    if(src&&officialCmsUrl(src)){push(src);break;}
   }
   if(!officialCmsUrl(img.getAttribute("src"))&&!officialCmsUrl(img.getAttribute("data-src"))){
    const first=(img.getAttribute("srcset")||"").split(",")[0].trim().split(/\s+/)[0];
    if(first)push(first);
   }
  }
 }else{
  // Also accept the CMS editor's copied plain-text list of image URLs.
  for(const textLine of text.split(/\r?\n/)){
   const field=textLine.split("|").pop().trim();
   if(field)push(field);
  }
 }
 return urls;
}
function normalizedImageStem(filename){
 let plain=String(filename||"").replace(/\\/g,"/");
 plain=plain.slice(plain.lastIndexOf("/")+1);
 try{plain=decodeURIComponent(plain);}catch(_){}
 return plain.toLowerCase().replace(/\.(png|jpe?g|webp|avif)$/,"").replace(/[^a-z0-9\u3400-\u9fff._-]/g,"");
}
function urlStem(url){
 try{return normalizedImageStem(new URL(url).pathname);}catch(_){return "";}
}
function matchImagesFromCms(raw){
 const urls=extractCmsImageUrls(raw);
 if(!S.files.length){return {total:urls.length,assigned:0,exact:0,byOrder:0,issues:["請先在改稿中心選擇這批新案件圖片，再匯入官網 HTML"]};}
 if(!urls.length){return {total:0,assigned:0,exact:0,byOrder:0,issues:["沒有找到晨陽官網可使用的圖片網址。請貼入 CMS 中真正已上傳圖片的 <img> HTML。"]};}
 const available=new Set(urls),assign=new Map(),used=new Set();
 let exact=0,byOrder=0;
 // Unique filename matches are the safest, including CMS conversion to webp.
 for(const item of S.files){
  const stem=normalizedImageStem(item.name);
  if(!stem)continue;
  const matches=[...available].filter(url=>{
   const target=urlStem(url);
   return target===stem||target.startsWith(stem+"-")||target.startsWith(stem+"_");
  });
  if(matches.length===1&&!used.has(matches[0])){
   assign.set(item,matches[0]);used.add(matches[0]);exact++;
  }
 }
 // Only allow order inference when pasted batch size exactly equals the
 // selected images count. Leave unknown/extra images unmatched otherwise.
 if(urls.length===S.files.length&&assign.size<S.files.length){
  const leftovers=S.files.filter(item=>!assign.has(item));
  const remaining=urls.filter(url=>!used.has(url));
  if(remaining.length===leftovers.length){
   for(let i=0;i<leftovers.length;i++){assign.set(leftovers[i],remaining[i]);byOrder++;}
  }
 }
 if(!assign.size){
  return {total:urls.length,assigned:0,exact:0,byOrder:0,issues:[
   "已找到 "+urls.length+" 張官網圖片，但沒有安全的檔名配對；圖片數與目前 "+S.files.length+" 張不同，為避免配錯不會自動填入。請只複製本次新上傳的圖片。"
  ]};
 }
 for(const [item,url] of assign){
  item.url=url;item.urlMatch=urlStem(url)===normalizedImageStem(item.name)?"檔名對應":"圖片上傳順序推定";
  item.verified=false;
 }
 $("cyexp-confirm-urls").checked=false;
 renderItems();
 const issues=[];
 if(assign.size!==S.files.length)issues.push("還有 "+(S.files.length-assign.size)+" 張無法可靠配對；請只複製本次圖片，或使用檔名清單");
 if(byOrder)issues.push("有 "+byOrder+" 張依上傳順序推定，仍須檢查每張縮圖是否對應正確官網網址");
 return {total:urls.length,assigned:assign.size,exact,byOrder,issues};
}
function showCmsMatch(result){
 const box=$("cyexp-cms-match-status");
 const lines=["從官網 HTML 找到 "+result.total+" 張圖片；自動帶入 "+result.assigned+" / "+S.files.length+" 張（檔名配對 "+result.exact+"、順序推定 "+result.byOrder+"）"];
 if(result.issues?.length)lines.push(...result.issues);
 if(result.assigned===S.files.length)lines.push("已一次帶入所有網址。圖片描述、ALT、新格局圖及正式上稿核對仍需完成。");
 box.textContent=lines.join("；");
 box.style.color=result.issues?.length?"#9a3412":"";
}
async function pasteCmsImages(){
 const btn=$("cyexp-paste-cms");btn.disabled=true;
 try{
  if(!navigator.clipboard)throw Error("此瀏覽器不支援剪貼簿讀取；請直接 Ctrl+V 貼入上方欄位。");
  let data="";
  // In Chrome the WYSIWYG clipboard frequently stores the IMG nodes as
  // text/html while readText returns only a visual summary. Prefer HTML.
  if(typeof navigator.clipboard.read==="function"){
   const items=await navigator.clipboard.read();
   for(const item of items){
    if(item.types.includes("text/html")){
     data=await (await item.getType("text/html")).text();
     if(data)break;
    }
   }
   if(!data){
    for(const item of items){
     if(item.types.includes("text/plain")){
      data=await (await item.getType("text/plain")).text();
      if(data)break;
     }
    }
   }
  }
  if(!data&&navigator.clipboard.readText)data=await navigator.clipboard.readText();
  if(!data)throw Error("剪貼簿中沒有 HTML 或文字圖片網址");
  $("cyexp-cms-html").value=data;
  showCmsMatch(matchImagesFromCms(data));
 }catch(error){
  $("cyexp-cms-match-status").textContent="無法讀取剪貼簿："+(error?.message||"未知原因")+"。請按 Ctrl+V 貼入上方輸入框，再點「自動讀取官網 HTML」。";
 }finally{btn.disabled=false;}
}
function applyBulkUrls(){
 const lines=$("cyexp-bulk-urls").value.split(/\r?\n/).map(x=>x.trim()).filter(Boolean);
 if(!lines.length||!S.files.length){message("先加入圖片並貼入官網網址。",true);return;}
 let changes=[];
 if(lines.every(x=>x.includes("|"))){
  const mapped=lines.map(x=>{const p=x.split("|");return {name:p[0].trim(),url:p.slice(1).join("|").trim()};});
  const seen=new Set();
  for(const pair of mapped){
   const item=S.files.find(x=>x.name===pair.name);
   if(!item||seen.has(item)||!validUrl(pair.url)){message("配對失敗："+pair.name+"。請使用圖片目前顯示的完整檔名與晨陽網址。",true);return;}
   changes.push([item,pair.url]);seen.add(item);
  }
 }else{
  if(lines.length!==S.files.length||!lines.every(validUrl)){
   message("依順序貼網址時，行數必須等於已選圖片張數（目前 "+S.files.length+" 張），且每行必須是晨陽官網圖片網址。",true);return;
  }
  changes=lines.map((url,i)=>[S.files[i],url]);
 }
 const all=changes.map(x=>x[1]);
 if(new Set(all).size!==all.length){message("批次網址有重複，請先檢查。",true);return;}
 for(const [item,url]of changes){item.url=url;item.verified=false;}
 $("cyexp-confirm-urls").checked=false;
 renderItems();
 message("已為 "+changes.length+" 張圖套用網址。請逐張開啟網址確認圖片可載入，再勾選最後的網址驗收項目。");
}
function generateSummary(){
 const descriptions=S.files.filter(x=>x.role!=="格局圖"&&x.description.trim()).map(x=>x.description.trim());
 if(!descriptions.length){message("沒有可用的圖片描述，請先讀圖再產生整體介紹。",true);return;}
 const project=chooseTitle(),kind=$("cyexp-type").value;
 const unique=[...new Set(S.files.filter(x=>x.role!=="格局圖").map(x=>x.role).filter(x=>x!=="其他"))];
 const highlights=unique.length?unique.slice(0,6).join("、"):"空間規劃";
 $("cyexp-intro").value=project+"新增室內設計提案，以"+highlights+"的空間配置呈現生活動線與收納規劃。本專區使用"+kind+"說明設計方向，實際尺寸、材質及工程成果仍須以核准圖說與現場確認為準。";
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
$("cyexp-connect").addEventListener("click",connectLocalAI);
$("cyexp-copy-start").addEventListener("click",()=>{
 const command="lms server start --port 1234 --bind 127.0.0.1 --cors";
 if(navigator.clipboard?.writeText){
  navigator.clipboard.writeText(command)
    .then(()=>localStatus("已複製啟動指令。請在 Windows PowerShell 貼上執行，確認本機服務運作後再按測試。"))
    .catch(()=>localStatus("瀏覽器禁止複製；請手動複製畫面中的 PowerShell 指令。",true));
 }else{localStatus("無法自動複製；請手動複製畫面中的 PowerShell 指令。",true);}
});
$("cyexp-local-read").addEventListener("click",readWithLocalAI);
$("cyexp-local-model").addEventListener("change",()=>{S.localModel=$("cyexp-local-model").value;localStatus("已選擇："+S.localModel+"；接著按「用本機 AI 重新讀取全部新圖片」。");});
$("cyexp-unit").addEventListener("change",refreshAutoAlts);
$("cyexp-type").addEventListener("change",refreshAutoAlts);
$("cyexp-summary").addEventListener("click",generateSummary);
$("cyexp-match-cms").addEventListener("click",()=>showCmsMatch(matchImagesFromCms($("cyexp-cms-html").value)));
$("cyexp-paste-cms").addEventListener("click",pasteCmsImages);
$("cyexp-approve-reviewed").addEventListener("click",approveReviewedBatch);
$("cyexp-apply-urls").addEventListener("click",applyBulkUrls);
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