/* 晨陽：同建案新增戶型。靜態站、本機圖片，不回傳原始圖給本站伺服器。 */
(function(){
"use strict";
const host=document.getElementById("case-expansion");
if(!host)return;
const $=id=>host.querySelector("#"+id);
const esc=s=>String(s??"").replace(/[&<>"']/g,ch=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[ch]));
const zones=["格局圖","玄關與客廳","玄關","客廳","客餐廳","廚房與走道","多功能工作區","臥室","更衣收納","其他"];
const S={base:[],drafts:[],known:new Map(),files:[],pipeline:null,translator:null,transformers:null,modelBusy:false,visionReady:false,verifiedBase:false,localConnected:false,localModel:"",cmsUrls:[],cmsVisionCache:new Map(),cmsCorsUnavailable:false,matchRunning:false,matchCancelled:false,matchControllers:new Set(),matchStartedAt:0,matchTimer:null,matchStage:"",matchStep:0,matchTotal:0,activeProjectId:"",caseStates:new Map(),fileImportBusy:false};
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
'<button type="button" id="cyexp-read" class="cyexp-main-action">AI 讀圖｜LM Studio Qwen3-VL（自動連線＋產生介紹與 ALT）</button>',
'<button type="button" id="cyexp-summary">依讀圖結果整理案件總覽</button></div>',
'<p id="cyexp-main-ai-status" role="status" class="cyexp-muted">選好圖片後，按上面的「AI 讀圖」即可連接 LM Studio 並分析圖片；不必先展開下方設定。</p>',
'<details class="cyexp-advanced" id="cyexp-cms-import-panel" open><summary>最快流程｜貼入官網編輯器圖片 HTML，自動辨識並配對全部網址</summary>',
'<p class="cyexp-muted">在晨陽官網編輯器將這次新增的圖片「一次批次上傳」，複製該批圖片的 HTML 貼到下面；系統會自動讀取所有 img src，優先以檔名與可驗證的圖像內容比對；即使張數相同，也不能直接依順序宣稱配對成功。官網重新命名時，請核對下方圖片縮圖。</p>',
'<textarea id="cyexp-cms-html" rows="5" placeholder="貼上官網編輯器圖片 HTML，例如：&lt;p&gt;&lt;img src=&quot;https://chen-yang.com.tw/upload/images/1.0.png&quot;&gt;&lt;/p&gt; ..."></textarea>',
'<div class="cyexp-actions"><button type="button" id="cyexp-match-cms">自動讀取官網 HTML 並配對圖片</button>',
'<button type="button" id="cyexp-paste-cms">直接讀取剪貼簿的 HTML／文字</button></div>',
'<p id="cyexp-cms-match-status" role="status" class="cyexp-muted">尚未讀取官網圖片；不會將順序推定視為成功配對。</p>',
'<div id="cyexp-cms-review" aria-label="官網圖片與本機原圖對照區"></div></details>',
'<details class="cyexp-advanced"><summary>快速上稿｜批次貼入所有圖片網址（免逐張輸入）</summary>',
'<p class="cyexp-muted">建議使用「圖片檔名 | 官網網址」。若只貼網址仍需驗證圖片內容，不能只憑順序確認。僅接受晨陽官網 HTTPS 圖片網址。</p>',
'<textarea id="cyexp-bulk-urls" rows="4" placeholder="https://chen-yang.com.tw/upload/images/新案-01.png&#10;https://chen-yang.com.tw/upload/images/新案-02.png"></textarea>',
'<button type="button" id="cyexp-apply-urls">批次套用圖片網址</button></details>',
'<details class="cyexp-advanced" id="cyexp-local-ai"><summary>本機 AI 進階設定與連線排錯｜LM Studio Qwen3-VL</summary>',
'<p class="cyexp-muted">僅連接此電腦的 127.0.0.1:1234，不會將圖片上傳到 GitHub。請先在 LM Studio 載入有看圖能力的模型（例如已安裝的 Qwen3-VL），啟動本機伺服器、開啟 CORS，建議啟用身分驗證並只綁定本機。Chrome 若詢問本機網路存取權限，需自行決定是否允許。</p>',
'<div class="cyexp-fields"><label>LM Studio 圖像模型<select id="cyexp-local-model" disabled><option value="">先按測試連線</option></select></label>',
'<label>LM Studio 本機 API Token（如已啟用身分驗證）<input id="cyexp-local-token" type="password" autocomplete="off" placeholder="僅在目前瀏覽器使用，不會儲存"></label></div>',
'<div class="cyexp-actions"><button type="button" id="cyexp-connect">測試本機 AI 連線／讀取模型</button>',
'<button type="button" id="cyexp-local-read" disabled>用本機 AI 重新讀取全部新圖片</button></div>',
'<p id="cyexp-local-status" role="status" class="cyexp-muted">尚未連接。主按鈕可以自動連線；這裡只在需要更換模型或排錯時使用。</p>',
'<button type="button" id="cyexp-fallback-read">改用較低品質的瀏覽器備援讀圖（手動選擇）</button>',
'<div class="cyexp-advanced"><p class="cyexp-muted"><strong>連不上時請依序排查：</strong>① 在 LM Studio → Developer 按 Start Server，確認 Port 1234；② 在 Server Settings 開啟 Enable CORS，保持 Serve on Local Network 關閉；③ 點下方「直接檢查本機 API」並確認回傳模型 JSON（若要求驗證可能顯示 401）；④ 回來按「測試本機 AI 連線」，並允許 Chrome 的本機網路權限。切勿關閉瀏覽器安全保護。</p>',
'<div class="cyexp-actions"><a id="cyexp-local-check-url" href="http://127.0.0.1:1234/v1/models" target="_blank" rel="noopener noreferrer">直接檢查本機 API（另開分頁）</a>',
'<button type="button" id="cyexp-copy-start">複製 LM Studio 啟動指令（PowerShell）</button></div>',
'<p class="cyexp-muted">建議 PowerShell 指令：<code>lms server start --port 1234 --bind 127.0.0.1 --cors</code>。若 LM Studio 已由圖形介面啟動，不必再開第二個 Server。啟用 CORS 時建議開啟 API 身分驗證。</p></div>',
'<p class="cyexp-muted">每張圖會個別送到你電腦的本機模型；不會寫入任何雲端 API 金鑰。讀圖產物仍需人工核對，格局圖不會由 AI 自動宣告驗收通過。</p></details>',
'<p class="cyexp-muted">AI 讀圖優先使用你已啟動的 LM Studio Qwen3-VL。免費瀏覽器小模型僅作為手動備援，不會自動取代本機 AI。所有描述與 ALT 都是待核對草稿。</p>',
'<p id="cyexp-vision-status" class="cyexp-muted" role="status"></p>',
'<div id="cyexp-items" class="cyexp-images"><p>請選擇新案件圖片；包含新平面配置圖／格局圖。</p></div>',
'<div class="cyexp-actions"><button type="button" id="cyexp-approve-reviewed">一鍵確認已檢查的 3D 圖／實景照（格局圖需另外核對）</button></div>',
'<p class="cyexp-muted">格局圖易被誤判：請查看原圖後單獨勾選。批次確認不會核准格局圖，也不會跳過圖片網址和原文保護檢查。</p>',
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
const draftPanel=document.createElement("section");
draftPanel.className="cyexp-draft-panel";
draftPanel.style.cssText="background:#f5f9ff;border:1px solid #bed4ed;border-radius:12px;padding:16px;margin-top:14px";
draftPanel.innerHTML=[
 '<h4 style="margin:0 0 6px">SEO 草稿｜AI 讀圖後立即整合</h4>',
 '<p class="cyexp-muted" id="cyexp-draft-state" role="status">選擇建案及圖片後，立即產生文章與圖片 ALT 草稿，不必先上傳官網圖片。</p>',
 '<div class="cyexp-actions"><button type="button" id="cyexp-copy-draft" disabled>複製 SEO 草稿 HTML（不可直接上稿）</button></div>',
 '<details class="cyexp-advanced" open><summary>草稿文章預覽與完整 HTML</summary><div id="cyexp-draft-preview"></div><textarea id="cyexp-draft-html" readonly rows="7"></textarea></details>'
].join("");
host.appendChild(draftPanel);
const matchHud=document.createElement("aside");
matchHud.id="cyexp-match-hud";
matchHud.hidden=true;
matchHud.setAttribute("role","status");
matchHud.setAttribute("aria-live","polite");
matchHud.style.cssText="position:fixed;bottom:18px;right:18px;width:min(420px,calc(100vw - 36px));z-index:9999;padding:16px;background:#122747;color:#fff;border-radius:14px;box-shadow:0 12px 35px rgba(10,30,50,.28)";
matchHud.innerHTML=[
 '<div style="display:flex;gap:12px;align-items:center;justify-content:space-between">',
 '<strong id="cyexp-match-hud-title">正在配對圖片</strong>',
 '<span id="cyexp-match-elapsed" style="font-size:12px">0 秒</span></div>',
 '<p id="cyexp-match-stage" style="margin:8px 0;font-size:13px;color:#e8f1ff">準備開始</p>',
 '<progress id="cyexp-match-meter" style="width:100%;height:12px" max="1" value="0"></progress>',
 '<div style="display:flex;justify-content:space-between;align-items:center;gap:12px;margin-top:8px">',
 '<span id="cyexp-match-numbers" style="font-size:12px">0 / 0 張</span>',
 '<button type="button" id="cyexp-stop-match" style="border:1px solid #fff;color:#fff;background:transparent;border-radius:8px;padding:8px 12px;cursor:pointer">停止配對</button>',
 '</div>'
].join("");
host.appendChild(matchHud);

// Beginner-first layout: MOVE existing controls, never clone/remove working
// AI or export controls. All IDs and event handlers remain unchanged.
// Technical settings and backup tools use progressive disclosure.
function buildBeginnerLayout(){
 const heading=host.querySelector(".cyexp-head");
 heading.querySelector("h3").textContent="同建案新增案例｜3 步完成";
 heading.querySelector("p").textContent="選照片與新格局圖 → AI 自動讀圖、產生 ALT → 從官網批次取得圖片網址並複製完整 HTML。原文章與舊格局圖完整保留。";
 const progress=document.createElement("div");progress.className="cyexp-progress";
 progress.id="cyexp-progress";
 progress.innerHTML='<span>① 選圖</span><span>② AI 草稿預覽</span><span>③ 正式上稿驗收</span>';
 const next=document.createElement("p");next.id="cyexp-next";next.className="cyexp-next";
 next.setAttribute("role","status");next.textContent="第一步：選擇新案件圖片，務必包含新的平面配置圖。";
 const section=(n,title,description)=>{
  const wrapper=document.createElement("section");wrapper.className="cyexp-step";wrapper.id="cyexp-step"+n;
  const head=document.createElement("div");head.className="cyexp-step-header";
  const h=document.createElement("h4");h.textContent=n+". "+title;
  const desc=document.createElement("p");desc.textContent=description;
  head.append(h,desc);wrapper.append(head);return wrapper;
 };
 const one=section(1,"選擇建案及圖片","照片與平面配置圖可一次選取；上傳後直接按 AI 讀圖，不必先進模型設定。");
 const two=section(2,"AI 圖文與官網圖片配對","先貼一次官網圖片 HTML，再於每張原圖卡片中直接選官網縮圖、核對介紹與 ALT。");
 const three=section(3,"正式上稿驗收與完整 HTML","核對原文、格局圖、官網圖片網址後才解鎖正式上稿 HTML。");
 const extra=document.createElement("details");extra.className="cyexp-advanced";extra.id="cyexp-extra";
 const summary=document.createElement("summary");summary.textContent="其他選項｜備份草稿、手動網址、更新原文（一般不需要）";
 extra.append(summary);
 const fields=$("cyexp-base").closest(".cyexp-fields");
 // One article selector: the top-level "選擇文章" controls this editor too.
 $("cyexp-base").closest("label").hidden=true;
 const currentProject=document.createElement("p");
 currentProject.id="cyexp-current-article-info";
 currentProject.className="cyexp-current-article";
 currentProject.setAttribute("role","status");
 currentProject.textContent="正在同步上方選擇的文章……";
 const internalId=$("cyexp-unit").closest("label");
 const actions=$("cyexp-files").closest(".cyexp-actions");
 const manualSummary=$("cyexp-summary");
 const summaryActions=document.createElement("div");summaryActions.className="cyexp-actions";
 summaryActions.appendChild(manualSummary);
 const intro=$("cyexp-intro").closest("label");
 const aiInfo=$("cyexp-main-ai-status");
 const localPanel=$("cyexp-local-ai");
 const cms=$("cyexp-cms-import-panel");
 const bulk=$("cyexp-bulk-urls").closest("details");
 const originals=$("cyexp-newbase").closest("details");
 const images=$("cyexp-items");
 const reviewed=$("cyexp-approve-reviewed").closest(".cyexp-actions");
 const reviewedHelp=reviewed.nextElementSibling;
 const imageStatus=$("cyexp-vision-status");
 const baseCheck=$("cyexp-confirm-base").closest("label");
 const urlCheck=$("cyexp-confirm-urls").closest("label");
 const planCheck=$("cyexp-confirm-floorplan").closest("label");
 const status=$("cyexp-status");
 const copyGroup=$("cyexp-copy").closest(".cyexp-actions");
 const exportBtn=$("cyexp-export");
 const importLabel=$("cyexp-import").closest("label");
 const preview=$("cyexp-html").closest("details");
 const savedIntro=$("cyexp-vision-status").previousElementSibling;
 const footer=host.lastElementChild;
 // Keep internal case ID available for audits but remove it from the
 // novice's required input flow; a safe internal default suffices.
 if(!$("cyexp-unit").value)$("cyexp-unit").value="新增設計案例";
 one.append(currentProject,fields,actions,aiInfo,localPanel);
 two.append(cms,images,reviewed,reviewedHelp,intro,summaryActions,imageStatus,draftPanel);
 const cmsTitle=cms.querySelector("summary");
 cmsTitle.textContent="匯入官網圖片 HTML｜每張原圖下方直接選圖";
 const cmsHelp=cms.querySelector("p.cyexp-muted");
 if(cmsHelp)cmsHelp.textContent="一次貼入官網批次圖片 HTML → 按自動配對 → 直接在下方每張原圖旁點選官網縮圖。AI 無法確認的才需要你選擇；不用來回捲動或手動輸入網址。";
 three.append(matchHud,baseCheck,urlCheck,planCheck,status,copyGroup,preview);
 extra.append(internalId,bulk,originals,exportBtn,importLabel);
 if(savedIntro?.matches("p.cyexp-muted"))savedIntro.remove();
 // Remove old repetitive direct-copy instructions; progress and three
 // grouped steps are now the single source of instructions.
 for(const child of [...host.children]){
  if(child===heading)continue;
  if(child.matches?.("p.cyexp-muted")&&!child.id)child.remove();
 }
 host.append(progress,next,one,two,three,extra);
 // Preserve any other nonempty existing panels under advanced settings.
 for(const child of [...host.children]){
  if([heading,progress,next,one,two,three,extra].includes(child))continue;
  if(child!==footer)extra.append(child);
  else if(child.matches?.("p.cyexp-muted"))child.remove();
  else extra.append(child);
 }
}
buildBeginnerLayout();
function message(text,isError){$("cyexp-vision-status").textContent=text;$("cyexp-vision-status").style.color=isError?"#b91c1c":"";}
function pickBase(){return S.base.find(x=>x.id===$("cyexp-base").value);}
function chooseTitle(){const p=pickBase();const d=S.drafts.find(x=>x.id===p?.id);return d?.project_name || (d?.title||p?.id||"").split("｜",1)[0];}
// Per-project workspaces live in memory for this tab. They intentionally keep
// File/Blob URLs and human edits separate, never copy materials to a new case.
function takeCaseSnapshot(){
 return {
  files:S.files,cmsUrls:S.cmsUrls,cmsVisionCache:S.cmsVisionCache,
  cmsCorsUnavailable:S.cmsCorsUnavailable,
  unit:$("cyexp-unit").value,type:$("cyexp-type").value,
  intro:$("cyexp-intro").value,newbase:$("cyexp-newbase").value,
  cmsHtml:$("cyexp-cms-html").value,bulkUrls:$("cyexp-bulk-urls").value,
  confirmedBase:$("cyexp-confirm-base").checked,
  confirmedUrls:$("cyexp-confirm-urls").checked,
  confirmedFloorplan:$("cyexp-confirm-floorplan").checked,
  visionMessage:$("cyexp-vision-status").textContent,
  cmsMessage:$("cyexp-cms-match-status").textContent
 };
}
function assignCaseSnapshot(saved){
 S.files=saved?.files||[];
 S.cmsUrls=saved?.cmsUrls||[];
 S.cmsVisionCache=saved?.cmsVisionCache||new Map();
 S.cmsCorsUnavailable=!!saved?.cmsCorsUnavailable;
 $("cyexp-unit").value=saved?.unit||"新增設計案例";
 $("cyexp-type").value=saved?.type==="實景照片"?"實景照片":"3D 建模示意圖";
 $("cyexp-intro").value=saved?.intro||"";
 $("cyexp-newbase").value=saved?.newbase||"";
 $("cyexp-cms-html").value=saved?.cmsHtml||"";
 $("cyexp-bulk-urls").value=saved?.bulkUrls||"";
 $("cyexp-confirm-base").checked=!!saved?.confirmedBase;
 $("cyexp-confirm-urls").checked=!!saved?.confirmedUrls;
 $("cyexp-confirm-floorplan").checked=!!saved?.confirmedFloorplan;
 $("cyexp-vision-status").textContent=saved?.visionMessage||"此案尚未加入新圖片，請選擇此案的新格局圖與設計圖片。";
 $("cyexp-cms-match-status").textContent=saved?.cmsMessage||"此案尚未匯入官網圖片 HTML；其他案場的網址不會帶入。";
}
function topSelectedArticleId(){
 return document.getElementById("action-article")?.value||"";
}
function articleContextMatches(){
 const selected=topSelectedArticleId();
 return !!(selected&&S.activeProjectId===selected&&pickBase()?.id===selected);
}
function showActiveCaseIdentity(){
 const node=$("cyexp-current-article-info");
 const project=pickBase();
 if(!project||!articleContextMatches()){
  node.textContent="尚未同步目前選擇的 SEO 文章，禁止混用其他案場的原文與圖片。";
  node.dataset.status="blocked";
  return;
 }
 const draft=S.drafts.find(x=>x.id===project.id);
 const name=draft?.project_name||draft?.title||project.id;
 const existingImages=(project.html_with_media?.match(/<img\b/gi)||[]).length;
 node.textContent="目前編輯："+name+"｜已載入此案原文（既有圖片 "+existingImages+
   " 張）｜本案新增圖片 "+S.files.length+" 張。不同案場資料獨立保存。";
 node.dataset.status="ready";
}
function switchToCase(nextId){
 if(!S.base.length)return false;
 if(S.modelBusy||S.matchRunning||S.fileImportBusy)return false;
 if(nextId===S.activeProjectId){
  showActiveCaseIdentity();updateStatus();return true;
 }
 if(S.activeProjectId)S.caseStates.set(S.activeProjectId,takeCaseSnapshot());
 S.activeProjectId=nextId||"";
 const project=S.base.find(x=>x.id===nextId);
 $("cyexp-base").value=project?project.id:"";
 assignCaseSnapshot(project?S.caseStates.get(project.id):null);
 showActiveCaseIdentity();
 renderItems();
 renderCmsPairingReview();
 if(!project){
  message("所選文章沒有經驗證的完整原文與圖片資料，不能沿用上一個案場；請檢查文章資料同步。",true);
 }else if(!S.caseStates.has(project.id)){
  message("已切換到「"+(S.drafts.find(x=>x.id===project.id)?.project_name||project.id)+
   "」。原文章與舊圖已載入；新案例圖片尚未選取，請加入此案新圖片。");
 }
 return !!project;
}
function handleMainSeoArticleSelection(event){
 if(!S.base.length)return;
 const nextId=String(event?.detail?.id||"");
 if(nextId===S.activeProjectId){showActiveCaseIdentity();return;}
 if(S.modelBusy||S.matchRunning||S.fileImportBusy){
  event.detail.revertTo=S.activeProjectId;
  event.preventDefault();
  message("正在為目前案場讀圖或配對，為避免跨案場串圖，請完成或停止後再切換文章。",true);
  return;
 }
 switchToCase(nextId);
}
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
function isPlanFileName(name){
 return /(?:平面|格局|配置圖|配置_?|floor.?plan|layout.?plan)/i.test(String(name||""));
}
function safePlanDescription(){
 // Do not extrapolate woodwork, furniture, finishing, room counts or scale
 // from tiny floorplan previews. This is intentionally a conservative image
 // TYPE description, NOT a claim the model has interpreted exact plan detail.
 return "此圖為住宅平面配置圖，呈現室內空間分區與相對位置，供了解格局及動線安排；房間名稱、尺寸與實際配置應以原始核准圖面為準。";
}
function unsafeFloorplanClaim(a){
 if(a.role!=="格局圖")return "";
 const text=String(a.description||"")+" "+String(a.alt||"");
 const material=/(?:木作|木皮|木紋|木質|木色|木製|木地板|材質|色調|牆面線條|裝飾|氛圍|渲染|採光|窗簾|光線|實景|完工|3D\s?建模|立體圖|示意實景)/i;
 const furniture=/(?:沙發|茶几|電視牆|電視櫃|電視機|衣櫃|展示櫃|化妝台|床頭背板|造型櫃)/i;
 if(material.test(text)||furniture.test(text))
  return "這張是格局圖，描述或 ALT 卻包含材質、家具或 3D 效果等未經圖面核實的內容；請改成平面配置與動線的客觀描述。";
 if(!/平面|格局|配置|動線/.test(text))
  return "格局圖的描述或 ALT 缺少平面配置資訊，請先修正。";
 return "";
}
function resetForFloorplan(a){
 a.role="格局圖";
 a.altSuffix="";
 a.description=safePlanDescription();
 a.alt=makeAlt(a);a.autoAlt=a.alt;
 a.verified=false;
 a.origin="辨識為平面配置圖：採保守且不臆測材質與家具的說明；這不是精確圖面判讀，請人工核對格局。";
}
function makeAlt(a){
 // Public ALT: project + evidence-backed place + what the image actually is
 // + brand. Never include the internal unit code.
 const project=chooseTitle();
 const region={
  "seo-danfo-234":"林口A7","seo-yunjiang-331":"林口A7",
  "seo-hongguang-253":"林口A7","seo-fumei-503":"新莊頭前",
  "seo-lixuan-217":"林口","seo-housheng-451":"中壢A20",
  "ai-kaohsiung-536":"高雄仁武"
 }[pickBase()?.id]||"";
 const where=region?region+" ":"";
 if(a.role==="格局圖")
  return project+"｜"+where+"住宅平面配置圖與空間動線｜晨陽設計";
 const kind=$("cyexp-type").value;
 const detail=String(a.altSuffix||a.description||a.role||"室內空間")
  .replace(/[\r\n]+/g," ").replace(/[｜|]+/g,"、").trim();
 return project+"｜"+where+detail.slice(0,40)+"｜"+kind+"｜晨陽設計";
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
 // This pre-reviewed 9-image catalogue belongs ONLY to 丹佛花都.
 if(S.activeProjectId!=="seo-danfo-234")return false;
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
function selectOfficialPicture(item,index,url){
 if(url&&!validUrl(url))return;
 const owner=url&&S.files.find(x=>x!==item&&x.url===url);
 if(owner){message("這張官網圖已配給「"+owner.name+"」，請先清除原配對。",true);return;}
 if(item.url!==url){
  item.url=url;item.urlPairVerified=false;
  item.urlMatch=url?"手動選擇候選圖，待核對":"尚未配對官網圖片";
  $("cyexp-confirm-urls").checked=false;
 }
 item.pickerOpen=false;
 // Refresh all in-card candidate buttons so previously chosen CMS images
 // instantly show "already used" elsewhere. Keep typed descriptions in S.
 renderItems();
 renderCmsPairingReview();
}
function inlineCmsMatcher(item,index){
 const panel=document.createElement("section");panel.className="cyexp-inline-matcher";
 const header=document.createElement("div");header.className="cyexp-inline-match-head";
 const title=document.createElement("strong");title.textContent="選擇對應的官網圖片";
 const count=document.createElement("span");count.className="cyexp-muted";
 count.textContent=S.cmsUrls.length?"可選 "+S.cmsUrls.length+" 張":"尚未取得官網圖片";
 header.append(title,count);panel.appendChild(header);
 const official=validUrl(item.url)?item.url:"";
 if(official){
  const selected=document.createElement("div");selected.className="cyexp-inline-selected";
  const picture=document.createElement("img");picture.src=official;
  picture.alt="目前對應官網圖片，請與左側本機原圖比較";picture.loading="lazy";
  const info=document.createElement("div");info.className="cyexp-inline-selected-info";
  const suffix=cmsImageUrlSuffix(official);
  const idx=S.cmsUrls.indexOf(official);
  const heading=document.createElement("strong");
  heading.textContent=(idx>=0?"官網圖 "+(idx+1):"目前官網圖片")+"｜"+suffix.code;
  const digits=document.createElement("p");digits.textContent="數字末3位："+suffix.digits+"　檔名末3碼："+suffix.code;
  const status=document.createElement("p");status.className="cyexp-muted";
  const aiMatched=/Qwen3-VL/.test(String(item.urlMatch||""));
  status.textContent=item.urlPairVerified?(aiMatched?"AI 比對通過，建議再目視確認":"人工配對已確認"):"尚未確認圖片一致";
  const actions=document.createElement("div");actions.className="cyexp-inline-pair-actions";
  const check=document.createElement("label");check.className="cyexp-check";
  const tick=document.createElement("input");tick.type="checkbox";
  tick.checked=!!item.urlPairVerified;tick.disabled=!item.preview;
  check.append(tick,document.createTextNode(aiMatched?"AI 已比對相同（仍建議目視抽查）":"確認官網圖與左側原圖相同"));
  tick.addEventListener("change",()=>{
   if(!item.preview){tick.checked=false;item.urlPairVerified=false;return;}
   item.urlPairVerified=tick.checked;
   item.urlMatch=tick.checked?"人工目視確認圖片相同":"尚未核對圖片";
   status.textContent=tick.checked?"圖片配對已確認":"尚未確認圖片一致";
   renderCmsPairingReview();updateStatus();
  });
  const clear=document.createElement("button");clear.type="button";
  clear.className="cyexp-clear-pair";clear.textContent="清除配對";
  clear.addEventListener("click",()=>selectOfficialPicture(item,index,""));
  actions.append(check,clear);info.append(heading,digits,status,actions);
  selected.append(picture,info);panel.append(selected);
 }
 if(S.cmsUrls.length){
  const choices=document.createElement("details");choices.className="cyexp-image-choice";
  choices.open=!!item.pickerOpen;
  const summary=document.createElement("summary");
  summary.textContent=official?"更換官網圖片（開啟縮圖選擇）":"開啟官網縮圖，直接選擇這張原圖的配對";
  choices.append(summary);
  const grid=document.createElement("div");grid.className="cyexp-inline-candidates";
  const populate=()=>{
   if(grid.dataset.built)return;
   grid.dataset.built="1";
   for(const [j,url]of S.cmsUrls.entries()){
   const owner=S.files.find(x=>x!==item&&x.url===url);
   const suffix=cmsImageUrlSuffix(url);
   const button=document.createElement("button");button.type="button";
   button.className="cyexp-inline-candidate";
   button.disabled=!!owner;
   if(official===url)button.classList.add("selected");
   if(owner)button.classList.add("occupied");
   button.setAttribute("aria-pressed",String(official===url));
   button.title=owner?"已配對："+owner.name:"選擇官網圖 "+(j+1)+"｜"+suffix.filename;
   const img=document.createElement("img");img.src=url;img.alt="官網候選圖 "+(j+1);img.loading="lazy";
   const name=document.createElement("strong");name.textContent="官網圖 "+(j+1)+"｜"+suffix.code;
   const detail=document.createElement("small");
   detail.textContent=owner?"已用："+owner.name:"數字末3位："+suffix.digits;
   button.append(img,name,detail);
   button.addEventListener("click",()=>selectOfficialPicture(item,index,url));
   grid.append(button);
   }
  };
  // Build candidate images only when the user actually opens the chooser.
  // 10 originals x 10 candidate pictures should not download 100 thumbnails.
  if(choices.open)populate();
  choices.addEventListener("toggle",()=>{
   if(!choices.isConnected)return;
   item.pickerOpen=choices.open;
   if(choices.open)populate();
  });
  choices.append(grid);panel.append(choices);
 }else{
  const empty=document.createElement("div");empty.className="cyexp-inline-empty";
  const hint=document.createElement("span");hint.textContent="批次貼入官網圖片 HTML 後，就能在此卡片直接選圖，不必來回捲動。";
  const jump=document.createElement("button");jump.type="button";jump.textContent="前往批次匯入";
  jump.addEventListener("click",()=>{
   const target=$("cyexp-cms-import-panel");target.open=true;
   target.scrollIntoView({behavior:"smooth",block:"start"});
   $("cyexp-cms-html").focus({preventScroll:true});
  });
  empty.append(hint,jump);panel.append(empty);
 }
 return panel;
}
function itemBox(a,i){
 const card=document.createElement("article");card.className="cyexp-item";card.id="cyexp-image-card-"+i;
 const side=document.createElement("div");side.className="cyexp-thumb";
 if(a.preview){const img=document.createElement("img");img.src=a.preview;img.alt="僅供編輯者預覽的新圖片";side.appendChild(img);}
 else{const missing=document.createElement("div");missing.textContent="尚未重新選圖，可用正式圖片網址上稿";side.appendChild(missing);}
 const name=document.createElement("div");name.className="cyexp-muted";name.textContent=(i+1)+". "+(a.name||"已匯入圖片資料");side.appendChild(name);
 card.appendChild(side);
 const right=document.createElement("div");right.className="cyexp-item-fields";
 right.appendChild(inlineCmsMatcher(a,i));
 const role=document.createElement("label");role.textContent="圖片類型／空間";
 const sel=document.createElement("select");sel.dataset.attr="role";
 for(const z of zones){const op=document.createElement("option");op.value=z;op.textContent=z;sel.appendChild(op);}
 sel.value=a.role||"其他";role.appendChild(sel);right.appendChild(role);
 right.appendChild(textField(a.role==="格局圖"?
  "平面配置圖描述（保守說明，非 AI 精讀圖面）":
  "AI 讀圖描述（請依畫面核對）",a.description,"description",true));
 right.appendChild(textField("圖片 ALT（建案與畫面優先，不強制寫戶型）",a.alt,"alt",false));
 const urlBox=document.createElement("details");urlBox.className="cyexp-advanced";
 const urlSummary=document.createElement("summary");
 urlSummary.textContent="其他方式｜手動輸入官網圖片網址（一般不需要）";
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
 state.textContent=a.origin||"尚未讀圖：請點「AI 讀圖」，或自行描述畫面。";right.appendChild(state);
 if(a.role==="格局圖"){
  const explanation=document.createElement("p");explanation.className="cyexp-plan-note";
  explanation.textContent="平面配置圖｜僅描述空間配置及動線，不推測木作、材質、沙發、電視牆或完工效果。";
  right.appendChild(explanation);
  const violation=unsafeFloorplanClaim(a);
  if(violation){const warning=document.createElement("p");warning.className="cyexp-plan-warning";warning.textContent=violation;right.appendChild(warning);}
 }
 const btns=document.createElement("div");btns.className="cyexp-actions";
 const confirm=document.createElement("label");confirm.className="cyexp-check";
 const box=document.createElement("input");box.type="checkbox";box.dataset.attr="verified";box.checked=!!a.verified;
 box.disabled=!!unsafeFloorplanClaim(a);
 confirm.appendChild(box);confirm.appendChild(document.createTextNode("我已核對這張圖的空間、描述與 ALT"));btns.appendChild(confirm);
 const remove=document.createElement("button");remove.type="button";remove.textContent="移除圖片";
 remove.addEventListener("click",()=>{if(a.preview)URL.revokeObjectURL(a.preview);S.files=S.files.filter(x=>x!==a);renderItems();});btns.appendChild(remove);
 right.appendChild(btns);card.appendChild(right);
 right.addEventListener("input",ev=>{
  const x=ev.target.dataset.attr;if(!x||x==="role"||x==="verified")return;
  a[x]=ev.target.value;
  if(x==="description"||x==="alt"){
   // "Reviewed" refers to the exact text that was checked. Editing a
   // single character invalidates it IMMEDIATELY, not only after blur.
   a.verified=false;box.checked=false;
  }
  if(x==="url"){
   a.urlPairVerified=false;
   $("cyexp-confirm-urls").checked=false;
   urlSummary.textContent="其他方式｜手動輸入官網圖片網址（一般不需要）";
  }
  updateStatus();
 });
 right.addEventListener("change",ev=>{
  const x=ev.target.dataset.attr;if(!x)return;
  if(x==="verified"){
   if(unsafeFloorplanClaim(a)){a.verified=false;box.checked=false;renderItems();return;}
   a.verified=ev.target.checked;updateStatus();return;
  }
  const wasAuto=!!(a.autoAlt&&a.alt===a.autoAlt);
  if(x==="role"){
   const oldRole=a.role;
   a.role=ev.target.value;
   if(a.role==="格局圖"||isPlanFileName(a.name)){resetForFloorplan(a);}
   else{
    if(oldRole==="格局圖"){a.description="";a.altSuffix="";a.alt="";a.autoAlt="";a.origin="已改分類，請重新 AI 讀圖，不得沿用格局圖描述";}
    else if(!a.alt?.trim()||wasAuto){a.alt=makeAlt(a);a.autoAlt=a.alt;}
    a.verified=false;
   }
   renderItems();return;
  }
  a[x]=ev.target.value;
  if(x==="description"){
   if(!a.alt?.trim()||wasAuto){a.altSuffix="";a.alt=makeAlt(a);a.autoAlt=a.alt;}
   a.verified=false;renderItems();return;
  }
  if(x==="alt"){a.autoAlt="";a.verified=false;renderItems();return;}
  if(x==="url")renderItems();else updateStatus();
 });
 return card;
}
function approveReviewedBatch(){
 if(!S.files.length){message("尚未加入圖片，無法批次核對。",true);return;}
 const incomplete=S.files.filter(x=>!x.description?.trim()||!x.alt?.trim()||!zones.includes(x.role)||unsafeFloorplanClaim(x));
 if(incomplete.length){message("還有 "+incomplete.length+" 張圖片缺少說明、ALT，或格局圖仍有不實材質／家具敘述。請先修改，不能整批核對。",true);return;}
 const plans=S.files.filter(x=>x.role==="格局圖");
 for(const a of S.files)if(a.role!=="格局圖")a.verified=true;
 for(const a of plans)a.verified=false;
 renderItems();
 message("已批次確認非格局圖 "+(S.files.length-plans.length)+" 張；"+plans.length+
  " 張平面配置圖仍須逐張核對一次，不能用批次按鈕跳過圖面確認。之後再核對官網圖片網址。");
}
function renderItems(){
 const box=$("cyexp-items");box.replaceChildren();
 if(!S.files.length){const p=document.createElement("p");p.textContent="尚未加入新案件圖片。新增格局圖為必填項目。";box.appendChild(p);}
 for(const [i,a]of S.files.entries()){
  if(isPlanFileName(a.name)&&a.role!=="格局圖")resetForFloorplan(a);
  if(unsafeFloorplanClaim(a))a.verified=false;
  box.appendChild(itemBox(a,i));
 }
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
 const suppliedUrls=S.files.map(x=>x.url?.trim()).filter(Boolean);
  const unique=new Set(suppliedUrls).size===suppliedUrls.length;
 const alt=S.files.every(x=>x.alt?.trim()&&x.description?.trim()&&x.verified);
 const pairVerified=S.files.every(x=>x.urlPairVerified===true);
 const unit=$("cyexp-unit").value.trim();
 const project=chooseTitle();
 const pasted=$("cyexp-newbase").value.trim();
 const validatedBase=!!(base?.media_integrated&&base?.floorplan_protection_passed&&base?.preservation_audit?.original_main_content_preserved);
 const items=[];
 if(!articleContextMatches())items.push("上方文章與目前新增案例不一致；禁止跨案場輸出");
 if(!project||!base)items.push("請選擇已有原文的建案");
 if(!unit)items.push("請填新增案件的內部識別名稱");
 if(!S.files.length)items.push("尚未選擇新案件圖片");
 if(!floor.length)items.push("缺少新的平面配置圖／格局圖");

 if(!urls)items.push("新圖片尚未全部取得有效的晨陽官網 HTTPS 圖片網址");
 if(!unique)items.push("新圖片網址重複，請修正");
 if(S.files.length&&urls&&!pairVerified)items.push("尚有 "+S.files.filter(x=>!x.urlPairVerified).length+" 張未核對官網圖片與原圖的對應，正式上稿暫停");
 if(!alt)items.push("圖片描述、ALT 或逐張人工核對尚未完成");
 const badPlans=S.files.filter(a=>unsafeFloorplanClaim(a));
 if(badPlans.length)items.push("有 "+badPlans.length+" 張格局圖含有木作、家具或材質等未核實敘述，禁止匯出");
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
function mergeCaseIntoArticleBeforeClosingSections(original,caseSection){
 // Preserve the original CMS HTML byte-for-byte and insert only one new block.
 // FAQ and "extended reading" belong after the case content, not before it.
 // Reading only heading tags avoids matching FAQ/extended-reading words in prose.
 const headingRe=/<h([1-6])\b[^>]*>[\s\S]*?<\/h\1\s*>/gi;
 let match,offset=original.length;
 while((match=headingRe.exec(original))){
  const plain=match[0].replace(/<[^>]*>/g,"")
   .replace(/&nbsp;|&#160;|&#xA0;/gi," ").trim();
  if(/^(?:常見問題(?:\s*FAQ)?|FAQ(?:\s|[｜：:]|$)|延伸閱讀(?:\s|[｜：:]|$))/i.test(plain)){
   offset=match.index;
   break;
  }
 }
 if(offset===original.length)return original+caseSection;
 // Move the existing <hr> separator with the FAQ/extended-reading footer.
 // This keeps a divider between case pictures and original closing sections.
 const prefix=original.slice(0,offset);
 const separator=prefix.match(/\s*<hr\b[^>]*\/?>\s*$/i);
 if(separator)offset-=separator[0].length;
 return original.slice(0,offset)+caseSection+original.slice(offset);
}
function generate({draft=false,preview=false}={}){
 if(!articleContextMatches())throw Error("文章選擇尚未同步，禁止跨案場產出 HTML");
 const base=baseHtml();
 if(!base)return "";
 const project=chooseTitle(),kind=$("cyexp-type").value;
 const intro=$("cyexp-intro").value.trim();
 let h="\n<hr>\n<section class=\"chenyang-case-addition\" data-append-version=\"2\">\n";
 h+="<h2>"+esc(project+"｜室內設計新提案與空間收納規劃")+"</h2>\n";
 h+="<p>"+esc(intro||(draft?"【待補：請先依讀圖結果整理案件介紹】":""))+"</p>\n";
 const list=[...S.files].sort((a,b)=>(a.role==="格局圖"?-1:0)-(b.role==="格局圖"?-1:0));
 let zone="";
 for(const a of list){
  if(a.role!==zone){zone=a.role;h+="<h3>"+esc(zone==="格局圖"?project+"｜平面配置與空間動線":zone+"｜空間設計重點")+"</h3>\n";}
  const description=String(a.description||"").trim();
  const detail=(description||"【待補 AI 讀圖描述："+(a.name||"未命名圖片")+"】")+
   "（"+(a.role==="格局圖"?"平面配置圖，請以最終核准圖說為準":kind+"，非施工完成證明")+"）";
  h+="<p>"+esc(detail)+"</p>\n";
  const official=validUrl(a.url)?a.url.trim():"";
  const localPreview=draft&&preview&&!official&&a.preview?a.preview:"";
  if(!draft&&!official)throw Error("正式 HTML 不得使用未取得公開網址的新圖片："+a.name);
  h+="<figure data-image-filename=\""+esc(a.name||"")+"\">";
  if(official||localPreview){
    h+="<img loading=\"lazy\" decoding=\"async\" src=\""+esc(official||localPreview)+"\" alt=\""+esc(a.alt?.trim()||"待核對圖片 ALT")+"\">";
  }else{
    h+="<p class=\"chenyang-draft-missing-image\" data-image-url-status=\"pending\">"+
      esc("【待補官網圖片網址："+(a.name||"未命名圖片")+"；草稿不可直接上稿】")+"</p>";
  }
  h+="<figcaption>"+esc(project+"｜"+zone+"｜"+(a.role==="格局圖"?"平面配置圖":kind)+(draft&&!official?"｜待補正式圖片網址":""))+"</figcaption></figure>\n";
 }
 h+="</section>\n";
 const banner=draft?'<div class="chenyang-seo-draft-warning" data-publish-status="not-approved" style="padding:12px;border:1px solid #af6420;background:#fff4de"><strong>SEO 草稿｜未通過正式上稿驗收，不可直接發佈</strong><p>待補官網圖片網址的圖以標示呈現；AI 描述與格局圖需人工核對。</p></div>\n':"";
 return banner+mergeCaseIntoArticleBeforeClosingSections(base,h);
}
function updateStatus(){
 const c=checks(),status=$("cyexp-status");
 status.className="cyexp-status "+(c.pass?"ready":"blocked");
 const headline=c.pass?"正式上稿驗收通過":"正式上稿還有 "+c.issues.length+" 項待完成（SEO 草稿可先使用）";
 const count="保留舊圖 "+c.originalImageCount+" 張（原格局圖 "+c.oldFloorplanCount+" 張）｜新增圖片 "+c.newImageCount+" 張｜新格局圖 "+c.newFloorplanCount+" 張";
 const imagesReady=S.files.length>0;
 const captionsReady=imagesReady&&S.files.every(x=>x.description?.trim()&&x.alt?.trim());
 const reviewedReady=captionsReady&&S.files.every(x=>x.verified&&!unsafeFloorplanClaim(x));
 const urlReady=imagesReady&&S.files.every(x=>validUrl(x.url));
 const stage=!imagesReady?1:(!reviewedReady?2:3);
 const prog=$("cyexp-progress")?.querySelectorAll("span")||[];
 for(let i=0;i<prog.length;i++){
  const n=i+1;
  prog[i].dataset.state=n<stage?"done":n===stage?"active":"waiting";
  if(n===stage)prog[i].setAttribute("aria-current","step");
  else prog[i].removeAttribute("aria-current");
 }
 const tip=$("cyexp-next");
 if(tip){
  tip.textContent=!imagesReady?"現在：選擇建案與圖片，必須包含新格局圖。":
   !captionsReady?"現在：按「AI 讀圖」，Qwen3-VL 會自動產生圖片介紹與 ALT。":
   !reviewedReady?"現在：檢查 AI 的描述與 ALT，按「一次核對全部」。":
   c.newFloorplanCount===0?"現在：補上這次新案件的格局圖，不能用舊圖冒充。":
   !urlReady?"SEO 草稿可直接預覽及複製；正式上稿前請先批次上傳官網圖片，再到第三步配對網址。":
   c.pass?"完成：已保留舊圖與新格局圖，可以複製 HTML。":
   "現在：完成第三步的原文、圖片網址與格局圖核對，就能複製 HTML。";
 }
 status.replaceChildren();
 const b=document.createElement("strong");b.textContent=headline;status.appendChild(b);
 const p=document.createElement("p");p.textContent=count;status.appendChild(p);
 if(c.issues.length){
  const details=document.createElement("details");details.className="cyexp-issues";
  const summary=document.createElement("summary");summary.textContent="查看尚未完成的 "+c.issues.length+" 個檢查項目";details.appendChild(summary);
  const ul=document.createElement("ul");
  for(const issue of c.issues){const li=document.createElement("li");li.textContent=issue;ul.appendChild(li);}
  details.appendChild(ul);status.appendChild(details);
 }
 // Draft preview is always available before official URL and CMS verification.
 const canDraft=!!(articleContextMatches()&&pickBase()&&baseHtml()&&S.files.length);
 const pendingUrls=S.files.filter(x=>!validUrl(x.url)).length;
 const pendingText=S.files.filter(x=>!x.description?.trim()||!x.alt?.trim()).length;
 $("cyexp-copy-draft").disabled=!canDraft;
 $("cyexp-draft-html").value=canDraft?generate({draft:true}):"";
 $("cyexp-draft-state").textContent=canDraft?
  "草稿已即時更新｜新圖 "+S.files.length+" 張，待補官網網址 "+pendingUrls+" 張，待補 AI 描述或 ALT "+pendingText+" 張。草稿不是正式上稿核准。":
  "選擇建案及圖片後即自動產生草稿；不須先取得官網圖片網址。";
 const draftPreview=$("cyexp-draft-preview");draftPreview.replaceChildren();
 if(canDraft){
  const frame=document.createElement("iframe");
  frame.setAttribute("sandbox","");
  frame.title="SEO 草稿全文預覽（含尚未公開的本機圖片）";
  frame.style.cssText="width:100%;max-width:100%;height:440px;border:1px solid #d6dfe8;border-radius:10px;background:white";
  frame.srcdoc='<!doctype html><html lang="zh-Hant"><head><meta charset="utf-8">'+
   '<style>html,body{max-width:100%;overflow-x:hidden;font:16px/1.8 sans-serif}body{padding:12px;margin:0}img{max-width:100%;height:auto;display:block;margin:10px auto}figure{margin:12px 0}figcaption{font-size:13px;color:#64748b}</style></head><body>'+
   generate({draft:true,preview:true})+'</body></html>';
  draftPreview.appendChild(frame);
 }
 $("cyexp-copy").disabled=!c.pass;
 $("cyexp-html").value=c.pass?generate():"正式上稿驗收尚未完成；SEO 草稿可在第二步預覽及複製。";
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
 let matched=0,added=0,restored=0;
 for(const file of fresh){
  const a={name:file.name,file,preview:URL.createObjectURL(file),sha256:"",
   role:/(?:平面|格局|配置|floor.?plan)/i.test(file.name)?"格局圖":"其他",
   description:"",alt:"",altSuffix:"",url:"",verified:false,urlPairVerified:false,origin:"尚未由 AI 讀圖"};
  try{a.sha256=await identify(file);}catch(_){}
  const existing=a.sha256?S.files.find(x=>x.sha256===a.sha256):null;
  if(existing){
   if(!existing.file){
    // JSON backup has original image SHA-256, not the image bytes.
    // Reattach the exact same image while preserving edited descriptions,
    // ALT, and official URLs. Verification does not carry over.
    existing.file=file;existing.preview=a.preview;
    existing.verified=false;
    existing.urlPairVerified=!!existing.savedUrlPairVerified&&validUrl(existing.url);
    existing.urlMatch=existing.urlPairVerified?
     "從草稿恢復已核對配對（原圖 SHA-256 一致；仍須確認網站 URL）":(existing.urlMatch||"待核對圖片");
    delete existing.savedUrlPairVerified;
    existing.origin="已核對原圖 SHA-256，保留已編輯的圖片描述與 ALT";
    restored++;
   }else URL.revokeObjectURL(a.preview);
   continue;
  }
  if(isPlanFileName(a.name)){resetForFloorplan(a);}
  else if(await enrichKnown(a))matched++;
  S.files.push(a);added++;
 }
 renderItems();
 message("新增 "+added+" 張圖片；從備份草稿重新連結 "+restored+" 張原圖；參考辨識命中 "+matched+" 張。舊的描述、ALT 與圖片網址會保留，但正式上稿核對仍需完成。");
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
 $("cyexp-main-ai-status").textContent=txt;
 $("cyexp-main-ai-status").style.color=err?"#b91c1c":"";
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
  localStatus("本機 LM Studio 已連線："+S.localModel+"。按「AI 讀圖」就會分析這次選取的全部圖片。");
 }catch(e){
  S.localConnected=false;$("cyexp-local-model").disabled=true;
  $("cyexp-local-ai").open=true;
  localStatus(localError(e),true);
 }
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
 let done=0,fail=0,planSafe=0,visionDone=0;
 try{
  for(let i=0;i<S.files.length;i++){
   const a=S.files[i];
   if(!a.file){fail++;localStatus("第 "+(i+1)+" 張未重新選圖，無法讀取。",true);continue;}
   localStatus("本機 AI 正在讀第 "+(i+1)+" / "+S.files.length+" 張："+a.name);
   try{
    const found=a.role==="格局圖"||isPlanFileName(a.name)?null:await localVisionOne(a.file,model);
    const manuallyEdited=!!(a.alt&&(!a.autoAlt||a.alt!==a.autoAlt));
    if(a.role==="格局圖"||isPlanFileName(a.name)){
     // Never ask a generic room caption model to imagine a 3D scene from a
     // 2D floorplan. This intentionally uses a conservative, auditable caption.
     resetForFloorplan(a);planSafe++;
    }else{
     a.description=found.description;
     a.altSuffix=""; // Invalidate older reference captions after new AI read.
     if(found.role!=="格局圖")a.role=found.role;
     if(!manuallyEdited){a.alt=makeAlt(a);a.autoAlt=a.alt;}
     a.origin="LM Studio 本機視覺模型 "+model+" 的草稿，仍須人工核對";
     a.verified=false;visionDone++;
    }
    done++;
   }catch(e){fail++;a.verified=false;localStatus("第 "+(i+1)+" 張出錯："+(e?.message||"讀圖失敗"),true);}
   renderItems();
  }
  if(done>0&&!$("cyexp-intro").value.trim())generateSummary();
  localStatus("處理完成：Qwen3-VL 已辨識 "+visionDone+" 張室內圖；"+planSafe+
   " 張格局圖採不臆測材質或家具的保守說明（並非精讀圖面）；失敗 "+fail+
   " 張。請先核對介紹與 ALT，格局圖須單獨勾選確認。",fail>0);
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
async function readBrowserFallback(){
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
   if(a.role==="格局圖"||isPlanFileName(a.name)){resetForFloorplan(a);renderItems();continue;}
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
   if(a.role==="格局圖"||isPlanFileName(a.name))resetForFloorplan(a);
   else{a.description=result;a.altSuffix="";a.alt=makeAlt(a);a.autoAlt=a.alt;a.verified=false;}
   renderItems();
  }
  message("已使用相容的 image-to-text 模型產生圖片描述；請核對中文、ALT、3D 示意圖身分及新格局圖。模型可能描述錯誤，確認後才能複製 HTML。");
 }catch(e){message("本機圖片辨識未完成："+(e?.message||"模型下載／執行失敗")+"。可換用桌面 Chrome／Edge 重新開啟，或將圖片交給 ChatGPT 讀圖後，把繁中描述貼回欄位；不會假裝模型已成功。",true);}
 finally{S.modelBusy=false;$("cyexp-read").disabled=false;updateStatus();}
}
async function readImages(){
 // A user click reconnects automatically after every page reload.
 // Never downgrade to the low-quality model without explicit choice.
 if(S.modelBusy)return;
 if(!S.files.length){
  localStatus("請先選擇要讀圖的照片及格局圖，再按「AI 讀圖」。",true);
  return;
 }
 if(!S.localConnected){
  $("cyexp-read").disabled=true;
  try{await connectLocalAI();}
  finally{$("cyexp-read").disabled=false;}
 }
 if(!S.localConnected)return; // Detailed error shown. No silent fallback.
 return readWithLocalAI();
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
/* LM Studio /v1/responses can fetch remote HTTPS images server-side.
   This avoids browser image-pixel CORS restrictions without a cloud API.
   A match needs two independent reversed visual comparisons, one-to-one.
   Visual model agreement is a model judgment, NOT byte-level proof. */
function parseRemoteVisionJson(response){
 const outputs=[];
 if(typeof response.output_text==="string")outputs.push(response.output_text);
 for(const entry of response.output||[]){
  if(typeof entry.text==="string")outputs.push(entry.text);
  for(const part of entry.content||[])if(typeof part.text==="string")outputs.push(part.text);
 }
 const raw=outputs.join("\n").replace(/<think>[\s\S]*?<\/think>/gi,"").trim();
 const a=raw.indexOf("{"),b=raw.lastIndexOf("}");
 if(a<0||b<=a)throw Error("本機 AI 沒有輸出可解析的圖片比對 JSON");
 try{return JSON.parse(raw.slice(a,b+1));}
 catch(_){throw Error("本機 AI 圖片比對結果不是合法 JSON");}
}
async function localImagePreviewData(file){
 if(!file)throw Error("找不到本機原圖");
 if(typeof createImageBitmap!=="function")return fileAsDataUrl(file);
 const image=await createImageBitmap(file);
 try{
  const scale=Math.min(1,900/Math.max(image.width,image.height));
  const canvas=document.createElement("canvas");
  canvas.width=Math.max(1,Math.round(image.width*scale));
  canvas.height=Math.max(1,Math.round(image.height*scale));
  const ctx=canvas.getContext("2d");
  if(!ctx)throw Error("無法建立本機圖片縮圖");
  ctx.fillStyle="#ffffff";ctx.fillRect(0,0,canvas.width,canvas.height);
  ctx.drawImage(image,0,0,canvas.width,canvas.height);
  return canvas.toDataURL("image/jpeg",0.82);
 }finally{image.close?.();}
}
function setCmsMatchProgress(stage,step=S.matchStep,total=S.matchTotal){
 S.matchStage=stage;S.matchStep=step;S.matchTotal=total;
 const hud=$("cyexp-match-hud");hud.hidden=!S.matchRunning;
 $("cyexp-match-stage").textContent=stage;
 $("cyexp-match-meter").max=Math.max(1,total);
 $("cyexp-match-meter").value=Math.max(0,Math.min(step,total));
 $("cyexp-match-numbers").textContent=total?(step+" / "+total+" 張"):"正在準備";
 $("cyexp-cms-match-status").textContent=stage;
}
function newCmsMatchController(ms=75000){
 const controller=new AbortController();
 S.matchControllers.add(controller);
 const timer=setTimeout(()=>controller.abort(),ms);
 return {signal:controller.signal,dispose:()=>{clearTimeout(timer);S.matchControllers.delete(controller);}};
}
function stopCmsMatch(){
 if(!S.matchRunning)return;
 S.matchCancelled=true;
 $("cyexp-stop-match").disabled=true;
 $("cyexp-match-hud-title").textContent="正在停止圖片配對";
 setCmsMatchProgress("已收到停止指令，正在中止請求並保留已完成結果。");
 for(const controller of S.matchControllers)controller.abort();
}
function focusFirstUnmatchedCmsImage(){
 if(!S.cmsUrls.length)return;
 const index=S.files.findIndex(item=>!item.urlPairVerified||!validUrl(item.url));
 if(index<0)return;
 const item=S.files[index];item.pickerOpen=true;
 const card=document.getElementById("cyexp-image-card-"+index);
 if(card)card.replaceWith(itemBox(item,index));
 const target=document.getElementById("cyexp-image-card-"+index);
 target?.scrollIntoView({behavior:"smooth",block:"center"});
}
async function runCmsMatch(raw){
 if(S.modelBusy){$("cyexp-cms-match-status").textContent="本機 Qwen3-VL 正在執行前面的圖片辨識；同時啟動配對可能導致記憶體不足。請在讀圖完成後再按配對。";return;}
 if(S.matchRunning){$("cyexp-cms-match-status").textContent="圖片仍在處理中，可使用右下角的「停止配對」取消。";return;}
 if(!String(raw||"").trim()){$("cyexp-cms-match-status").textContent="請先貼入晨陽後台圖片 HTML，再按自動配對。";return;}
 S.matchRunning=true;S.matchCancelled=false;S.matchStartedAt=Date.now();
 S.matchStep=0;S.matchTotal=0;
 $("cyexp-match-hud-title").textContent="正在比對官網圖片";
 $("cyexp-match-elapsed").textContent="0 秒";
 $("cyexp-stop-match").disabled=false;
 $("cyexp-match-cms").disabled=true;$("cyexp-paste-cms").disabled=true;
 setCmsMatchProgress("正在解析 HTML 並檢查圖片網址……",0,0);
 S.matchTimer=setInterval(()=>{
  if(!S.matchRunning)return;
  const elapsed=Math.floor((Date.now()-S.matchStartedAt)/1000);
  $("cyexp-match-elapsed").textContent=elapsed+" 秒";
 },1000);
 try{
  const result=await matchImagesFromCms(raw);
  if(S.matchCancelled){
   $("cyexp-cms-match-status").textContent="已停止配對。已確認的圖片資料保留，未完成圖片仍標記待確認。"+
    "目前已指派 "+result.assigned+"/"+S.files.length+" 張；需要時可再次按自動配對。";
  }else{
   showCmsMatch(result);
   $("cyexp-cms-match-status").textContent+="；本次耗時 "+((Date.now()-S.matchStartedAt)/1000).toFixed(1)+" 秒";
   focusFirstUnmatchedCmsImage();
  }
 }catch(e){
  $("cyexp-cms-match-status").textContent="圖片配對已中斷："+(e?.message||"未知錯誤")+"。未核對圖片不會輸出正式 HTML。";
 }finally{
  if(S.matchTimer){clearInterval(S.matchTimer);S.matchTimer=null;}
  for(const controller of S.matchControllers)controller.abort();
  S.matchControllers.clear();
  S.matchRunning=false;
  $("cyexp-match-hud").hidden=true;
  $("cyexp-match-cms").disabled=false;
  $("cyexp-paste-cms").disabled=false;
  updateStatus();
 }
}
async function localVisionRemoteRequest(remoteUrl,prompt,originalData,reverse=false){
 if(!validUrl(remoteUrl))throw Error("只允許晨陽官網 HTTPS 圖片作為遠端 AI 輸入");
 const model=$("cyexp-local-model").value||S.localModel;
 if(!S.localConnected||!model)throw Error("LM Studio 尚未連線或未選擇看圖模型");
 const contents=[{type:"input_text",text:prompt}];
 if(originalData){
  contents.push({type:"input_text",text:reverse?"第一張：官網圖片":"第一張：本機原圖"});
  contents.push({type:"input_image",image_url:reverse?remoteUrl:originalData});
  contents.push({type:"input_text",text:reverse?"第二張：本機原圖":"第二張：官網圖片"});
  contents.push({type:"input_image",image_url:reverse?originalData:remoteUrl});
 }else{
  contents.push({type:"input_image",image_url:remoteUrl});
 }
 if(S.matchCancelled)throw Error("使用者已停止配對");
 const tracked=newCmsMatchController(75000);
 try{
  const response=await fetch(LMSTUDIO_BASE+"/v1/responses",{
   method:"POST",headers:localAuthHeaders(true),mode:"cors",
   targetAddressSpace:"loopback",signal:tracked.signal,
   body:JSON.stringify({model,temperature:0,max_output_tokens:250,stream:false,input:[{role:"user",content:contents}]})
  });
  if(!response.ok)throw Error("LM Studio 遠端圖片 API HTTP "+response.status+"："+(await response.text()).slice(0,170));
  return parseRemoteVisionJson(await response.json());
 }finally{tracked.dispose();}
}
function visionMatchYes(result){
 const verdict=String(result?.same||"").toLowerCase();
 const evidence=Array.isArray(result?.matching_details)?result.matching_details:[];
 return verdict==="yes"&&evidence.length>=2&&evidence.every(v=>String(v||"").trim().length>=4);
}
async function matchRemoteImagesWithLMStudio(urls,remaining,used){
 const output={suggested:0,accepted:0,failed:0,fastConfirmed:0,deepConfirmed:0,cached:0,remoteCalls:0,reason:""};
 if(!remaining.size)return output;
 if(!S.files.some(x=>x.file&&x.description?.trim()))return {...output,reason:"本機原圖或 AI 描述不足，無法進行視覺自動配對"};
 if(!S.localConnected){
  setCmsMatchProgress("正在連接本機 LM Studio Qwen3-VL……",0,remaining.size);
  await connectLocalAI();
 }
 if(!S.localConnected)return {...output,reason:"本機 LM Studio 無法連線，請檢查已載入的 Qwen3-VL"};
 const originals=S.files.filter(x=>x.file&&x.description?.trim()&&!used.has(x));
 if(!originals.length)return output;
 const proposals=[];
 const originalImages=new Map();
 const total=remaining.size;
 for(const [number,url] of [...remaining].entries()){
  if(S.matchCancelled){output.reason="使用者已停止配對";break;}
  setCmsMatchProgress("第 "+(number+1)+"/"+total+" 張：Qwen3-VL 正在辨識官網圖片，接著比對本機原圖。",number,total);
  const catalogue=originals.map((item,i)=>{
   return i+"："+String(item.role||"其他")+"｜"+String(item.description||"").replace(/\s+/g," ").slice(0,140);
  }).join("\n");
  try{
   const cacheKey=JSON.stringify([S.localModel,url,catalogue,originals.map(x=>x.sha256||x.name)]);
   let shortlist=S.cmsVisionCache.get(cacheKey);
   if(shortlist)output.cached++;
   else{
    output.remoteCalls++;
    shortlist=await localVisionRemoteRequest(url,
     "仔細觀察這張官網室內設計圖片，從下面本機原圖文字說明挑選同一個攝影視角、相同家具位置與空間細節的 1-2 個候選。"+
     "不要只憑風格、材質或圖片順序猜測；只有唯一且非常清楚的候選才回 high，否則回 medium 或 low。"+
     '只回 JSON：{"visible":true,"candidate_indices":[0],"confidence":"high|medium|low","distinctive_features":["具體共同細節1","具體共同細節2"],"observation":"實際可見的關鍵物件位置"}。'+
     "索引從0開始，不得依照圖片順序推斷。\n本機圖片清單：\n"+catalogue);
    if(shortlist?.visible===true&&Array.isArray(shortlist.candidate_indices)){
     if(S.cmsVisionCache.size>=80)S.cmsVisionCache.delete(S.cmsVisionCache.keys().next().value);
     S.cmsVisionCache.set(cacheKey,shortlist);
    }
   }
   if(shortlist?.visible!==true||!Array.isArray(shortlist.candidate_indices))
    throw Error("本機 AI 未確認看見遠端圖片");
   const indexList=[...new Set(shortlist.candidate_indices.map(Number))]
    .filter(i=>Number.isInteger(i)&&i>=0&&i<originals.length).slice(0,2);
   const features=Array.isArray(shortlist.distinctive_features)?shortlist.distinctive_features:[];
   const fastCandidate=originals[indexList[0]]?.role!=="格局圖"&&indexList.length===1&&String(shortlist.confidence||"").toLowerCase()==="high"&&
    features.length>=2&&features.every(v=>String(v||"").trim().length>=5);
   for(const index of indexList){
    const original=originals[index];
    if(!originalImages.has(original))originalImages.set(original,await localImagePreviewData(original.file));
    const data=originalImages.get(original);
    const prompt="比較接下來兩張圖片，判斷是否同一張設計畫面的相同視角，即使第二張被重新命名、縮放、壓縮或稍微裁切。兩張不同客廳即使風格、家具類似也必須回答 no。不得只憑文字。"+
     "請逐一比對家具相對位置、畫框數量與位置、門窗、櫃體輪廓及背景。若看不到圖片或不確定則回答 unsure。只回 JSON："+ 
     '{"same":"yes|no|unsure","matching_details":["兩張共有的具體視覺特徵1","兩張共有的具體視覺特徵2"],"difference":"有何差異或無"}。';
    setCmsMatchProgress("第 "+(number+1)+"/"+total+" 張：正在比較官網圖與本機原圖細節。",number,total);
    output.remoteCalls++;
    const first=await localVisionRemoteRequest(url,prompt,data,false);
    if(!visionMatchYes(first))continue;
    let second=null;
    if(!fastCandidate){
     setCmsMatchProgress("第 "+(number+1)+"/"+total+" 張：候選有歧義，正在反向深度核對。",number,total);
     output.remoteCalls++;
     second=await localVisionRemoteRequest(url,prompt,data,true);
     if(!visionMatchYes(second))continue;
    }
    proposals.push({url,item:original,first,second,fast:fastCandidate});
    break;
   }
  }catch(error){
   output.failed++;
   output.reason=String(error?.message||"本機 AI 遠端讀圖失敗");
   if(S.matchCancelled)break;
   setCmsMatchProgress("第 "+(number+1)+"/"+total+" 張讀圖失敗："+output.reason,number,total);
   // Unsupported /v1/responses or inaccessible images are capability
   // failures; do not repeatedly run costly requests with fabricated matches.
   if(/HTTP 40[01435]|HTTP 50[013]|未確認看見遠端圖片|Failed to fetch|aborted/i.test(output.reason))break;
  }
  setCmsMatchProgress("已處理 "+(number+1)+"/"+total+" 張官網圖片。",number+1,total);
 }
 // Only accept unambiguous one-to-one image pairs. Two positive VLM calls
 // are visually cross-checked, but still carry the model-assisted label.
 const counts=new Map();
 for(const p of proposals)counts.set(p.item,(counts.get(p.item)||0)+1);
 for(const pair of proposals){
  if(counts.get(pair.item)!==1)continue;
  if(pair.item.urlPairVerified&&pair.item.url!==pair.url)continue;
  pair.item.url=pair.url;
  pair.item.urlPairVerified=true;
  pair.item.urlMatch=pair.fast?
   "Qwen3-VL 高信心快速視覺比對（非像素證明；上稿前抽查）":
   "Qwen3-VL 雙向深度視覺比對（非像素證明；上稿前抽查）";
  used.add(pair.item);remaining.delete(pair.url);
  output.accepted++;
  if(pair.fast)output.fastConfirmed++;else output.deepConfirmed++;
 }
 output.suggested=proposals.length;
 return output;
}
function cmsImageUrlSuffix(url){
 // CMS often gives hexadecimal filenames: show both the trailing 3 chars
 // (which may include letters) and the last 3 decimal digits.
 try{
  const encoded=new URL(url).pathname.split("/").pop()||"";
  let filename=encoded;try{filename=decodeURIComponent(encoded);}catch(_){}
  const stem=filename.replace(/\.[a-z0-9]{2,6}$/i,"");
  return {
   code:stem.slice(-3).toUpperCase()||"—",
   digits:(stem.match(/[0-9]/g)||[]).slice(-3).join("")||"—",
   filename
  };
 }catch(_){return {code:"—",digits:"—",filename:""};}
}
function renderCmsPairingReview(){
 const panel=$("cyexp-cms-review");panel.replaceChildren();
 if(!S.cmsUrls.length)return;
 const verified=S.files.filter(x=>x.urlPairVerified&&validUrl(x.url)).length;
 const heading=document.createElement("p");
 heading.className="cyexp-muted";
 heading.textContent="官網已載入 "+S.cmsUrls.length+" 張圖片；"+verified+"/"+S.files.length+
  " 張配對已確認。下方每張原圖旁皆有官網縮圖選擇器，不必在這裡逐張找圖。";
 panel.appendChild(heading);
 const pending=S.files.map((item,index)=>({item,index}))
  .filter(({item})=>!item.urlPairVerified||!validUrl(item.url));
 if(!pending.length)return;
 const area=document.createElement("div");area.className="cyexp-match-shortcuts";
 const heading2=document.createElement("strong");heading2.textContent="直接跳到待核對圖片：";
 area.appendChild(heading2);
 for(const {item,index} of pending){
  const button=document.createElement("button");button.type="button";
  button.textContent=(index+1)+". "+item.name;
  button.addEventListener("click",()=>{
   item.pickerOpen=true;
   const old=document.getElementById("cyexp-image-card-"+index);
   if(old)old.replaceWith(itemBox(item,index));
   else renderItems();
   const target=document.getElementById("cyexp-image-card-"+index);
   target?.scrollIntoView({behavior:"smooth",block:"center"});
  });
  area.append(button);
 }
 panel.append(area);
}
async function matchImagesFromCms(raw){
 const urls=extractCmsImageUrls(raw);S.cmsUrls=urls;
 if(!S.files.length)return {total:urls.length,assigned:0,exact:0,visual:0,unverified:0,issues:["請先在第一步選擇本機原圖"]};
 if(!urls.length)return {total:0,assigned:0,exact:0,visual:0,unverified:0,issues:["官網 HTML 沒有有效的圖片網址"]};
 const remaining=new Set(urls),used=new Set();
 let exact=0,visual=0;
 for(const item of S.files){
  if(item.url&&!urls.includes(item.url)){item.url="";item.urlMatch="";item.urlPairVerified=false;}
  if(item.urlPairVerified&&urls.includes(item.url)){remaining.delete(item.url);used.add(item);continue;}
  const stem=normalizedImageStem(item.name);
  const found=[...remaining].filter(url=>{
   const target=urlStem(url);
   return target===stem||(stem.length>=8&&!/^\d+$/.test(stem)&&(target.startsWith(stem+"-")||target.startsWith(stem+"_")));
  });
  if(found.length!==1)continue;
  item.url=found[0];item.urlPairVerified=false;
  item.urlMatch="唯一檔名相符，仍須核對圖片";
  remaining.delete(found[0]);used.add(item);exact++;
 }
 setCmsMatchProgress("正在檢查官網圖片網址與是否能讀取圖片像素……",0,urls.length);
 // Browser can compare the actual bytes only if the official site permits CORS.
 // Identical SHA256 is proof of identical image file bytes; similarity merely proposes a candidate.
 const remote=new Map();
 // Probe just one official CMS URL. Image upload files share the same host
 // and CORS policy. Do not make all 10 requests wait 7 seconds each if the
 // image server blocks pixel access from GitHub Pages.
 async function downloadForFingerprint(url,ms){
  if(S.matchCancelled)return null;
  const tracked=newCmsMatchController(ms);
  try{
   const response=await fetch(url,{mode:"cors",cache:"force-cache",signal:tracked.signal});
   if(!response.ok)throw Error("HTTP "+response.status);
   const blob=await response.blob();
   if(!blob.type.startsWith("image/"))throw Error("回傳不是圖片");
   const hash=await crypto.subtle.digest("SHA-256",await blob.arrayBuffer());
   const sha=Array.from(new Uint8Array(hash)).map(x=>x.toString(16).padStart(2,"0")).join("");
   const dh=await imageDhash(blob).catch(()=>"");
   remote.set(url,{sha,dh});
   return true;
  }catch(_){return false;}
  finally{tracked.dispose();}
 }
 if(remaining.size&&!S.cmsCorsUnavailable&&!S.matchCancelled){
  const all=[...remaining];
  const firstUrl=all[0];
  const canRead=await downloadForFingerprint(firstUrl,3000);
  if(canRead){
   await Promise.all(all.slice(1).map(url=>downloadForFingerprint(url,5000)));
  }else{
   // Repeated matching within this page skips the unusable CORS path and
   // immediately uses local vision instead.
   S.cmsCorsUnavailable=true;
  }
 }
 for(const item of S.files){
  if(used.has(item)||!item.file)continue;
  const candidates=[...remaining].filter(url=>remote.has(url));
  const identical=candidates.filter(url=>item.sha256&&remote.get(url).sha===item.sha256);
  if(identical.length===1){
   const url=identical[0];item.url=url;item.urlMatch="SHA-256 完全相同圖片";
   item.urlPairVerified=true;remaining.delete(url);used.add(item);visual++;continue;
  }
  let dh="";try{dh=await imageDhash(item.file);}catch(_){}
  if(!dh)continue;
  const ranked=candidates.filter(url=>remote.get(url).dh).map(url=>({url,dist:hammingHex(dh,remote.get(url).dh)})).sort((a,b)=>a.dist-b.dist);
  if(ranked[0]?.dist<=2&&(!ranked[1]||ranked[1].dist-ranked[0].dist>=8)){
   const url=ranked[0].url;item.url=url;item.urlMatch="像素相似候選，請核對";
   item.urlPairVerified=false;remaining.delete(url);used.add(item);visual++;
  }
 }
 // When filenames are randomized or browser CORS blocks pixels, let the
 // user's already-running local Qwen3-VL compare remote URLs to originals.
 const ai=remaining.size&&!S.matchCancelled?await matchRemoteImagesWithLMStudio(urls,remaining,used):
  {accepted:0,suggested:0,failed:0,reason:""};
 $("cyexp-confirm-urls").checked=false;
 renderItems();renderCmsPairingReview();
 const assigned=S.files.filter(x=>urls.includes(x.url)).length;
 const unverified=S.files.filter(x=>urls.includes(x.url)&&!x.urlPairVerified).length;
 const issues=[];
 if(assigned<S.files.length)issues.push("尚有 "+(S.files.length-assigned)+" 張官網圖片未可靠配對，請在下方縮圖區選擇");
 if(unverified)issues.push("尚有 "+unverified+" 張匹配候選未核對圖片內容");
 if(ai.accepted)issues.push("本機 Qwen3-VL 自動配對 "+ai.accepted+" 張（快速核對 "+ai.fastConfirmed+"、深度核對 "+ai.deepConfirmed+"；非像素證明，上稿前需抽查）");
 if(ai.remoteCalls)issues.push("本次本機 AI 呼叫 "+ai.remoteCalls+" 次；重複使用候選快取 "+ai.cached+" 次");
 if(ai.reason)issues.push("本機 AI 遠端比對限制："+ai.reason);
 if(remote.size===0&&exact<S.files.length&&!ai.accepted)issues.push("瀏覽器無法直接讀取官網圖片像素；已嘗試本機 AI 遠端讀圖，無法確認時不亂配");
 return {total:urls.length,assigned,exact,visual,ai:ai.accepted,unverified,issues};
}
function showCmsMatch(result){
 const box=$("cyexp-cms-match-status");
 const text=["官網圖片 "+result.total+" 張；已找到對應或候選 "+result.assigned+" / "+S.files.length+
  "（檔名 "+result.exact+"、像素 "+result.visual+"、本機 AI 確認 "+(result.ai||0)+"、順序推定 0）"];
 if(result.issues?.length)text.push(...result.issues);
 box.textContent=text.join("；");
 box.style.color=result.unverified||result.assigned<S.files.length?"#9a3412":"#157356";
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
  await runCmsMatch(data);
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
 for(const [item,url]of changes){item.url=url;item.urlPairVerified=false;item.verified=false;}
 S.cmsUrls=[...new Set(changes.map(x=>x[1]))];
 $("cyexp-confirm-urls").checked=false;
 renderItems();
 message("已套用 "+changes.length+" 個網址，但未證明圖片內容對應正確。請核對原圖和官網縮圖。");
 renderCmsPairingReview();
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
  intro:$("cyexp-intro").value,items:S.files.map(({name,sha256,role,description,alt,url,verified,origin,urlPairVerified,urlMatch})=>({
   name,sha256,role,description,alt,url,verified,origin,
   urlPairVerified:!!urlPairVerified&&/^[a-f0-9]{64}$/i.test(String(sha256||""))&&validUrl(url),
   urlMatch:String(urlMatch||"").slice(0,180)
  })),
  note:"僅儲存文字／照片雜湊及正式圖片網址，不包含原始照片、現有 CMS HTML、任何 API 密鑰"
 };
 download("chenyang-new-case-draft-"+(base?.id||"unknown")+".json",JSON.stringify(safe,null,2));
}
async function importDraft(file){
 let data;try{data=JSON.parse(await file.text());}catch(_){message("草稿 JSON 格式錯誤",true);return;}
 if(data?.version!==1||!Array.isArray(data.items)||data.items.length>50){message("草稿版本或圖片數量不符合規範",true);return;}
 const project=S.base.find(x=>x.id===data.project_id);
 if(!project){
  message("這份草稿的案場 "+String(data.project_id||"未標示")+" 並不在可編輯文章內；為防止跨案場覆蓋，未匯入任何圖片。",true);
  return;
 }
 if(S.modelBusy||S.matchRunning||S.fileImportBusy){
  message("AI 仍在處理圖片，請完成或停止後再匯入另一案草稿。",true);return;
 }
 if(S.activeProjectId!==project.id){
  const main=document.getElementById("action-article");
  if(!main||![...main.options].some(x=>x.value===project.id)){
   message("請先在上方「選擇文章」切至「"+(S.drafts.find(x=>x.id===project.id)?.project_name||project.id)+
    "」；如果已完成請先切換歷史紀錄。草稿沒有覆蓋目前案場。",true);
   return;
  }
  main.value=project.id;
  main.dispatchEvent(new Event("change",{bubbles:true}));
  if(S.activeProjectId!==project.id){
   message("文章切換尚未完成，草稿沒有套用，避免跨案場覆蓋。",true);return;
  }
 }
 $("cyexp-unit").value=String(data.unit||"").slice(0,90);$("cyexp-type").value=data.type==="實景照片"?"實景照片":"3D 建模示意圖";
 $("cyexp-intro").value=String(data.intro||"").slice(0,2000);
 for(const a of S.files)if(a.preview)URL.revokeObjectURL(a.preview);
 S.files=data.items.map(x=>({
  name:String(x.name||"").slice(0,150),sha256:String(x.sha256||""),
  role:zones.includes(x.role)?x.role:"其他",
  description:String(x.description||"").slice(0,1500),
  alt:String(x.alt||"").slice(0,260),url:String(x.url||"").slice(0,1200),
  verified:false,urlPairVerified:false,
  savedUrlPairVerified:!!x.urlPairVerified&&/^[a-f0-9]{64}$/i.test(String(x.sha256||""))&&validUrl(String(x.url||"")),
  urlMatch:String(x.urlMatch||"").slice(0,180),
  origin:"已從草稿載入。需重新選取相同原圖才能恢復已確認的網址配對",preview:null,file:null
 }));
 $("cyexp-confirm-base").checked=false;$("cyexp-confirm-urls").checked=false;$("cyexp-confirm-floorplan").checked=false;
 renderItems();message("草稿已讀取。重新選取相同原圖後會透過 SHA-256 恢復已確認圖片配對；描述與 ALT 保留，正式上稿仍需核對。");
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
 const topId=topSelectedArticleId();
 // No hard-coded default case; use exactly the selected task.
 switchToCase(topId);
 if(!topId)message("已載入 "+S.base.length+" 篇原文章，請從上方「選擇文章」選取要編輯的案場。");
}
$("cyexp-files").addEventListener("change",ev=>{addFiles(ev.target.files||[]);ev.target.value="";});
$("cyexp-read").addEventListener("click",readImages);
$("cyexp-fallback-read").addEventListener("click",readBrowserFallback);
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
$("cyexp-match-cms").addEventListener("click",()=>runCmsMatch($("cyexp-cms-html").value));
$("cyexp-stop-match").addEventListener("click",stopCmsMatch);
$("cyexp-paste-cms").addEventListener("click",pasteCmsImages);
$("cyexp-approve-reviewed").addEventListener("click",approveReviewedBatch);
$("cyexp-apply-urls").addEventListener("click",applyBulkUrls);
$("cyexp-export").addEventListener("click",exportDraft);
$("cyexp-import").addEventListener("change",ev=>{if(ev.target.files[0])importDraft(ev.target.files[0]);ev.target.value="";});
$("cyexp-copy-draft").addEventListener("click",async()=>{
 if(!articleContextMatches()||!pickBase()||!baseHtml()||!S.files.length){updateStatus();return;}
 try{
  const html=generate({draft:true});
  if(navigator.clipboard?.writeText)await navigator.clipboard.writeText(html);
  else{
   const field=$("cyexp-draft-html");field.focus();field.select();
   if(!document.execCommand("copy"))throw Error("copy unavailable");
  }
  $("cyexp-draft-state").textContent="已複製 SEO 草稿 HTML。尚未通過正式上稿驗收，請勿直接發佈至官網。";
 }catch(_){$("cyexp-draft-state").textContent="無法自動複製，請選取下方草稿 HTML 原始碼手動複製。";}
});
$("cyexp-copy").addEventListener("click",async()=>{
 const c=checks();if(!c.pass){updateStatus();return;}
 try{await navigator.clipboard.writeText(generate());message("已複製：原文＋所有原格局圖＋新增案件＋新格局圖。正式上稿前請在 CMS 預覽再次核對。");}
 catch(_){message("瀏覽器複製失敗，請在下方 HTML 原始碼欄手動複製。",true);}
});
for(const id of ["cyexp-unit","cyexp-type","cyexp-intro","cyexp-newbase","cyexp-confirm-base","cyexp-confirm-urls","cyexp-confirm-floorplan"]){
 $(id).addEventListener("input",updateStatus);$(id).addEventListener("change",updateStatus);
}
document.addEventListener("chenyang:seo-article-selection",handleMainSeoArticleSelection);
start();
})();