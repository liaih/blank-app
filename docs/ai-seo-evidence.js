/* AI SEO evidence analyst for local browser. No scraping, login, paid APIs,
   uploads, or fabricated AI responses. Store only on this device. */
(function(root){
"use strict";
const KEY="chenyang-ai-evidence-v1";
const MAX_RECORDS=200;
const MAX_ANSWER=30000;
const BRANDS=["晨陽室內設計","晨陽設計","晨陽共好機構","謙鐿晨陽","晨陽"];
const dom=id=>document.getElementById(id);
const words=s=>String(s||"").normalize("NFKC").replace(/\s+/g,"").toLocaleLowerCase();
const normalizeName=s=>String(s||"").normalize("NFKC").trim().replace(/^[\p{P}\p{S}\s\d]+|[\p{P}\p{S}\s]+$/gu,"").slice(0,60);
const unique=arr=>[...new Set(arr.filter(Boolean))];
const own=n=>BRANDS.some(b=>words(n).includes(words(b)) || (words(n).length>2&&words(b).includes(words(n))));
const seen=(answer,term)=>words(answer).includes(words(term));
function urls(text){
  const matches=String(text||"").match(/https?:\/\/[^\s<>"'（）()]+/gi)||[];
  return unique(matches.map(value=>value.replace(/[,.，。；;]+$/u,"")).filter(value=>{
    try{return ["https:","http:"].includes(new URL(value).protocol)}catch{return false}
  })).slice(0,50);
}
function getDomain(url){
  try{return new URL(url).hostname.toLowerCase().replace(/^www\./,"")}catch{return ""}
}
function extractCandidates(answer){
  // Untrusted automated suggestions: user must confirm brands; these do not enter KPIs.
  const result=[];
  for(const rawLine of String(answer||"").split(/\r?\n/u)){
    let line=rawLine.replace(/^[\s>*#\-•\d.、)]+/u,"").replace(/\*\*/gu,"").trim();
    for(const match of line.matchAll(/([\p{Script=Han}A-Za-z0-9·&\-]{2,16}(?:室內設計|空間設計|設計工作室|設計公司))/gu)){
      const candidate=match[1];
      if(/^(桃園|台灣|全台|新竹|台中|高雄|台南|竹北|林口|專業|推薦|優質|知名|找|找尋|選擇|當地|在地|比較)/u.test(candidate)&&candidate.length<7)continue;
      if(/^(室內設計公司|在地室內設計|推薦室內設計|各家室內設計|其他室內設計|桃園室內設計|台灣室內設計|新竹室內設計|高雄室內設計|台中室內設計|台南室內設計)$/u.test(candidate))continue;
      result.push(candidate);
    }
  }
  return unique(result).slice(0,25);
}
function parseBrandLines(text,answer){
  const result=[];
  for(const raw of String(text||"").split(/[\r\n]+/u)){
    const brand=normalizeName(raw);
    if(!brand)continue;
    if(brand.length<2)throw Error("公司名稱至少 2 個字");
    if(!seen(answer,brand))throw Error("回答文字中沒有「"+brand+"」；不能把未出現的公司記成 AI 推薦");
    result.push(brand);
  }
  return unique(result).slice(0,40);
}
function evaluate(record){
  const list=record.recommended||[];
  const citations=unique(urls([record.answer,...(record.citations||[])].join("\n")));
  const mention=BRANDS.some(b=>seen(record.answer,b));
  const recommended=list.some(own);
  const cite=citations.some(u=>{const h=getDomain(u);return h==="chen-yang.com.tw"||h.endsWith(".chen-yang.com.tw")});
  const eligible=record.search==="yes"&&record.personalization==="clean"&&!!record.evidence_url;
  return {mentioned:mention,recommended,cited:cite,eligible,
    has_link:!!record.evidence_url, citations,
    competitors:list.filter(b=>!own(b)), source_status:eligible?"具可追溯條件（連結未自動核對）":"不納入受控聯網樣本"};
}
function validate(source){
  if(!source||typeof source!=="object")throw Error("資料格式不是有效物件");
  const platform=String(source.platform||"").trim();
  if(!["ChatGPT","Gemini","Perplexity","Google AI Mode","Microsoft Copilot","其他"].includes(platform))throw Error("AI 平台不正確");
  const prompt=String(source.prompt||"").trim();
  const answer=String(source.answer||"").trim();
  if(prompt.length<8||prompt.length>1500)throw Error("提問內容必須在 8～1500 字內");
  if(answer.length<30||answer.length>MAX_ANSWER)throw Error("回答文字至少 30 字、最多 30000 字");
  const evidence_url=String(source.evidence_url||"").trim();
  if(evidence_url){
    let u;
    try{u=new URL(evidence_url)}catch{throw Error("證據連結格式不正確")}
    if(!["https:","http:"].includes(u.protocol))throw Error("證據連結只能使用 http 或 https");
    if(evidence_url.length>1500)throw Error("證據連結過長");
  }
  const search=String(source.search||"unknown");
  const personalization=String(source.personalization||"unknown");
  if(!["yes","no","unknown"].includes(search))throw Error("網路搜尋狀態無效");
  if(!["clean","personalized","unknown"].includes(personalization))throw Error("個人化狀態無效");
  const stamp=String(source.answered_at||"");
  if(!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/u.test(stamp)||Number.isNaN(new Date(stamp).getTime()))throw Error("回答日期不正確");
  const recommended=unique((source.recommended||[]).map(normalizeName)).filter(Boolean);
  if(recommended.length>40)throw Error("推薦公司超過上限");
  for(const name of recommended){if(!seen(answer,name))throw Error("推薦名單的「"+name+"」不在回答原文中")}
  const citations=unique((source.citations||[]).flatMap(urls));
  if(citations.length>50)throw Error("引用連結超過上限");
  return {
    id:String(source.id||("sample-"+stamp+"-"+Math.random().toString(36).slice(2,10))).slice(0,130),
    platform,prompt,answer,answered_at:stamp,
    search,personalization,evidence_url,
    model:String(source.model||"").trim().slice(0,160),
    recommended,citations,added_at:String(source.added_at||new Date().toISOString())
  };
}
function summarize(records){
  const valid=records.map(r=>({r,stats:evaluate(r)}));
  const eligible=valid.filter(x=>x.stats.eligible);
  const groups={};
  for(const {r,stats} of eligible){
    if(!groups[r.platform])groups[r.platform]={samples:0,mentioned:0,recommended:0,cited:0,brands:{}};
    const g=groups[r.platform];
    g.samples++;
    g.mentioned+=Number(stats.mentioned);
    g.recommended+=Number(stats.recommended);
    g.cited+=Number(stats.cited);
    for(const n of stats.competitors)g.brands[n]=(g.brands[n]||0)+1;
  }
  return {
    total:records.length,
    controlled:eligible.length,
    mentioned:eligible.filter(x=>x.stats.mentioned).length,
    recommended:eligible.filter(x=>x.stats.recommended).length,
    cited:eligible.filter(x=>x.stats.cited).length,
    competitors:Object.entries(eligible.reduce((all,{stats})=>{
      for(const n of stats.competitors)all[n]=(all[n]||0)+1;
      return all;
    },{})).sort((a,b)=>b[1]-a[1]||a[0].localeCompare(b[0])),
    platforms:groups
  };
}
let records=[],snapshot=null;
function load(){
  try{
    const parsed=JSON.parse(localStorage.getItem(KEY)||"[]");
    if(!Array.isArray(parsed))throw Error("資料格式錯誤");
    records=parsed.slice(0,MAX_RECORDS).map(validate);
  }catch(error){
    records=[];
    dom("ai-evidence-status").textContent="本機儲存資料無法讀取："+String(error.message||error)+"。原始資料未被自動清除。";
  }
}
function store(){
  const content=JSON.stringify(records);
  if(content.length>3_000_000)throw Error("本機證據資料過大，請先匯出備份再整理");
  localStorage.setItem(KEY,content);
}
function createRow(tbody,values){
  const tr=document.createElement("tr");
  for(const value of values){
    const td=document.createElement("td");td.textContent=String(value);tr.append(td);
  }tbody.append(tr);return tr;
}
function draw(){
  const stats=summarize(records);
  dom("ai-evidence-total").textContent=stats.total+" 筆";
  dom("ai-evidence-controlled").textContent=stats.controlled+" 筆";
  dom("ai-evidence-mentioned").textContent=stats.controlled?stats.mentioned+"／"+stats.controlled:"資料不足";
  dom("ai-evidence-recommended").textContent=stats.controlled?stats.recommended+"／"+stats.controlled:"資料不足";
  dom("ai-evidence-cited").textContent=stats.controlled?stats.cited+"／"+stats.controlled:"資料不足";
  const table=dom("ai-platform-body");table.replaceChildren();
  for(const [platform,g] of Object.entries(stats.platforms)){
    createRow(table,[platform,g.samples,g.mentioned,g.recommended,g.cited,Object.keys(g.brands).length+" 間"]);
  }
  if(!Object.keys(stats.platforms).length)createRow(table,["尚未取得可比聯網樣本","—","—","—","—","—"]);
  const competitors=dom("ai-competitor-body");competitors.replaceChildren();
  for(const [name,n] of stats.competitors)createRow(competitors,[name,n+" 次","使用者確認的推薦名單；需回查原始回答"]);
  if(!stats.competitors.length)createRow(competitors,["暫無可比樣本的競品資料","—","—"]);
  const history=dom("ai-evidence-history");history.replaceChildren();
  for(const [index,r] of records.slice().reverse().entries()){
    const flags=evaluate(r);
    const tr=createRow(history,[r.answered_at.slice(0,16).replace("T"," "),r.platform,
      r.prompt.slice(0,50),flags.recommended?"有推薦晨陽":flags.mentioned?"只提及晨陽":"未提及晨陽",
      flags.competitors.join("、")||"—",flags.has_link?"有證據連結":"無證據連結",
      flags.eligible?"可納入受控樣本":"條件不足"]);
    const action=document.createElement("td");
    const copy=document.createElement("button");
    copy.className="clean";copy.type="button";copy.textContent="檢視";
    const realIndex=records.length-index-1;
    copy.addEventListener("click",()=>showRecord(realIndex));
    action.append(copy);tr.append(action);
  }
  if(!records.length)createRow(history,["尚無匯入資料","—","—","—","—","—","—","—"]);
  dom("ai-evidence-scope").textContent=stats.total?
    "目前本機有 "+stats.total+" 筆使用者提供的回答，其中 "+stats.controlled+" 筆符合受控聯網條件。這不是平台實際消費者的市場份額；證據網址未經系統自動核實。":
    "目前沒有可核對的聯網 AI 回答；因此不顯示虛構的品牌推薦率、競品排行或引用率。";
}
function showRecord(i){
  const r=records[i];if(!r)return;
  const result=evaluate(r);
  const view=dom("ai-record-preview");view.replaceChildren();
  const heading=document.createElement("h4");heading.textContent=r.platform+"｜"+r.prompt;view.append(heading);
  const info=document.createElement("p");
  info.textContent="時間："+r.answered_at+"｜搜尋："+r.search+"｜個人化："+r.personalization+"｜狀態："+result.source_status;
  view.append(info);
  const paragraph=document.createElement("pre");paragraph.className="ai-answer-preview";
  paragraph.textContent=r.answer;view.append(paragraph);
  const summary=document.createElement("p");summary.textContent=
   "確認推薦公司："+(r.recommended.join("、")||"未標記")+"；引用網址："+result.citations.length+" 個";
  view.append(summary);
  if(r.evidence_url){
    const a=document.createElement("a");a.href=r.evidence_url;a.textContent="開啟這筆回答的分享證據";
    a.target="_blank";a.rel="noopener noreferrer";view.append(a);
  }
  const remove=document.createElement("button");remove.type="button";remove.className="ai-action secondary";
  remove.textContent="刪除此筆本機紀錄";
  remove.addEventListener("click",()=>{
    if(!confirm("確定只從目前瀏覽器刪除這筆回答紀錄？"))return;
    const old=records.slice();records.splice(i,1);
    try{store();view.replaceChildren();draw()}catch(err){records=old;alert(String(err.message||err))}
  });view.append(remove);
}
function localStamp(){
 const d=new Date();
 const z=n=>String(n).padStart(2,"0");
 return d.getFullYear()+"-"+z(d.getMonth()+1)+"-"+z(d.getDate())+"T"+z(d.getHours())+":"+z(d.getMinutes());
}
function saveForm(){
 const source={
   platform:dom("ai-input-platform").value,
   prompt:dom("ai-input-prompt").value,
   answer:dom("ai-input-answer").value,
   evidence_url:dom("ai-input-proof").value,
   answered_at:dom("ai-input-time").value,
   search:dom("ai-input-search").value,
   personalization:dom("ai-input-clean").value,
   model:dom("ai-input-model").value,
   recommended:dom("ai-input-brands").value.split(/\r?\n/u).filter(Boolean),
   citations:urls(dom("ai-input-citations").value)
 };
 const item=validate(source);
 if(records.length>=MAX_RECORDS)throw Error("已到 200 筆上限，請先匯出備份與整理");
 const old=records.slice();records.push(item);
 try{store()}catch(error){records=old;throw error}
 dom("ai-evidence-status").textContent="已儲存到這台裝置的瀏覽器；這筆資料不會自動同步其他手機或電腦。";
 dom("ai-input-answer").value="";
 dom("ai-input-brands").value="";
 dom("ai-input-citations").value="";
 dom("ai-input-proof").value="";
 dom("ai-input-time").value=localStamp();
 draw();
}
function exportData(){
 const data={format:"chenyang-ai-evidence-v1",created_at:new Date().toISOString(),records};
 const blob=new Blob([JSON.stringify(data,null,2)],{type:"application/json;charset=utf-8"});
 const url=URL.createObjectURL(blob);
 const a=document.createElement("a");a.href=url;a.download="晨陽AI搜尋回答證據_"+new Date().toISOString().slice(0,10)+".json";
 a.click();setTimeout(()=>URL.revokeObjectURL(url),1500);
 dom("ai-evidence-status").textContent="已產生本機 JSON 備份；檔案包含回答原文，請勿公開上傳。";
}
async function importData(file){
 if(file.size>2_000_000)throw Error("匯入檔案不得超過 2 MB");
 const parsed=JSON.parse(await file.text());
 if(parsed.format!=="chenyang-ai-evidence-v1"||!Array.isArray(parsed.records))throw Error("不是此系統匯出的有效證據檔");
 if(parsed.records.length>MAX_RECORDS)throw Error("單一檔案最多 200 筆");
 const newRecords=parsed.records.map(validate);
 const merged=new Map(records.map(r=>[r.id,r]));
 for(const r of newRecords)merged.set(r.id,r);
 if(merged.size>MAX_RECORDS)throw Error("合併後超過 200 筆上限");
 const old=records;records=[...merged.values()];
 try{store()}catch(error){records=old;throw error}
 dom("ai-evidence-status").textContent="已匯入 "+newRecords.length+" 筆，合併後共 "+records.length+" 筆，資料只存在本機。";
 draw();
}
function init(data){
 snapshot=data;
 load();draw();
 dom("ai-input-time").value=localStamp();
 const select=dom("ai-prompt-bank");
 for(const [label,prompt] of (data.ai_prompt_bank||[])){
   const option=document.createElement("option");
   option.value=prompt;option.textContent=label+"｜"+prompt.slice(0,60);select.append(option);
 }
 select.addEventListener("change",()=>{
   if(select.value)dom("ai-input-prompt").value=select.value;
 });
 dom("ai-detect-brands").addEventListener("click",()=>{
   const answer=dom("ai-input-answer").value;
   const candidates=extractCandidates(answer);
   if(!answer.trim()){dom("ai-evidence-status").textContent="請先貼上 AI 回答原文";return}
   if(candidates.length){
     dom("ai-input-brands").value=candidates.join("\n");
     dom("ai-evidence-status").textContent="已產生可能的公司名稱，請逐一核對並刪除非公司名稱或非推薦的項目，再儲存。";
   }else{
     dom("ai-evidence-status").textContent="沒有可靠辨識到公司名稱。請依照 AI 回答逐行填寫它實際推薦的公司。";
   }
   dom("ai-input-citations").value=urls(answer).join("\n");
 });
 dom("ai-save-evidence").addEventListener("click",()=>{
   try{saveForm()}catch(err){dom("ai-evidence-status").textContent="無法儲存："+String(err.message||err)}
 });
 dom("ai-export-evidence").addEventListener("click",exportData);
 dom("ai-import-evidence").addEventListener("change",async e=>{
   const file=e.target.files?.[0];if(!file)return;
   try{await importData(file)}catch(err){dom("ai-evidence-status").textContent="無法匯入："+String(err.message||err)}
   e.target.value="";
 });
}
root.AISeoEvidence={init,urls,extractCandidates,parseBrandLines,evaluate,validate,summarize};
})(typeof window!=="undefined"?window:globalThis);
