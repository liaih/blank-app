/* Daily Google SEO checks and separate history, published by real GSC Actions.
   This module NEVER contacts Google Search Console or an AI scraper from a browser. */
(()=>{
"use strict";
const $=id=>document.getElementById(id);
const monitored=["室內設計","室內設計推薦","桃園室內設計"];
const showDate=value=>value?String(value).slice(0,10).replace(/-/g,"/"):"未取得";
const num=x=>x===null||x===undefined||!Number.isFinite(Number(x))?"—":Number(x).toLocaleString("zh-TW",{maximumFractionDigits:2});
const rank=x=>x===null||x===undefined||!Number.isFinite(Number(x))?"未取得":Number(x).toFixed(2);
const taiwanDay=()=>new Date(Date.now()+8*3600000).toISOString().slice(0,10);
const valid=x=>x&&x.schema_version===1&&x.no_mock===true&&x.not_live_google_serp===true&&
  x.site==="https://chen-yang.com.tw/"&&typeof x.check_date==="string"&&Array.isArray(x.keywords);
const sourceLink="https://github.com/liaih/Repository/actions/workflows/gsc-daily-check.yml";
let daily=null,history=null;
function cell(row,text){
 const td=document.createElement("td");
 td.textContent=String(text);row.appendChild(td);return td;
}
function findKeyword(row,term){
 return (Array.isArray(row?.keywords)?row.keywords:[]).find(k=>k.keyword===term);
}
function renderCurrent(){
 const label=$("seo-daily-status"),summary=$("seo-daily-source"),tbody=$("seo-daily-keywords");
 if(!label||!tbody)return;
 tbody.replaceChildren();
 if(!valid(daily)){
  label.textContent="待首次日檢";label.className="label wait";
  $("seo-daily-date").textContent="今天 "+showDate(taiwanDay())+" 尚無檢查紀錄";
  summary.textContent="原有 30／90 天數字是舊公開快照，不是今天新抓到的 Google 數據。新的每日檢查尚未完成或尚未同步。";
  const tr=document.createElement("tr");cell(tr,"尚無正式 GSC 日檢結果");cell(tr,"—");cell(tr,"—");cell(tr,"—");cell(tr,"—");tbody.appendChild(tr);
  $("seo-daily-note").textContent="GSC 平均排名依實際搜尋曝光加權，不是固定地區／裝置的即時 Google 排名。";
  return;
 }
 const current=daily.check_date===taiwanDay();
 const status=daily.status==="ok"?"真實 GSC 資料已驗證":daily.status==="delayed"?"GSC 資料更新延遲":"資料尚未取得";
 label.className="label "+(current&&daily.status==="ok"?"yes":"wait");
 label.textContent=current?status:"今日尚未檢查（前次："+showDate(daily.check_date)+"）";
 $("seo-daily-date").textContent=(current?"今日檢查":"前次檢查")+"："+showDate(daily.check_date)+
  "｜實際執行："+String(daily.checked_at||"未提供").replace("T"," ").slice(0,16);
 summary.textContent="Google 官方數據實際截止："+showDate(daily.gsc_latest_day)+
  "｜預期資料日："+showDate(daily.gsc_expected_through)+
  "｜"+daily.status_text+"。今天執行檢查不代表 Google 提供今天的排名。";
 $("seo-daily-note").textContent=daily.coverage_warning?
   "30／90 天期間有部分日期沒有官方全站資料，總點擊僅計入已回傳日期；無排名不等於沒被搜尋到。":
   "核心字詞的平均排名依 GSC 實際曝光加權；最新單日數據的日期可能早於今天。";
 for(const term of monitored){
  const entry=findKeyword(daily,term),latest=entry?.current_30d||{};
  const tr=document.createElement("tr");
  cell(tr,term);
  cell(tr,rank(latest.position));
  cell(tr,rank(latest.latest_daily_position));
  cell(tr,showDate(latest.last_observed_day));
  cell(tr,latest.impressions===null||latest.impressions===undefined?"—":num(latest.impressions));
  tbody.appendChild(tr);
 }
 if(daily.status==="ok"||daily.status==="delayed"){
  window.dispatchEvent(new CustomEvent("chenyang:gsc-daily-ready",{detail:daily}));
 }
}
function renderHistory(){
 const body=$("seo-history-rows"),label=$("seo-history-state");
 if(!body||!label)return;
 body.replaceChildren();
 const all=Array.isArray(history?.entries)?history.entries.filter(valid):[];
 const selected=$("seo-history-filter").value;
 const count=selected==="all"?all.length:Number(selected);
 const rows=all.slice().sort((a,b)=>b.check_date.localeCompare(a.check_date)).slice(0,count);
 label.textContent="已保存 "+all.length+" 個日檢日期｜"+"紀錄的是每天當時查到的 GSC 數據，不是 Google 當天即時排名。";
 if(!rows.length){
  const tr=document.createElement("tr");const td=cell(tr,"歷史紀錄尚未建立；首次正式日檢成功同步後自動新增。");
  td.colSpan=7;body.appendChild(tr);return;
 }
 for(const record of rows){
  const tr=document.createElement("tr");
  cell(tr,showDate(record.check_date));
  cell(tr,record.status==="ok"?"已驗證":record.status==="delayed"?"更新延遲":"待取得");
  cell(tr,showDate(record.gsc_latest_day));
  const metric=record.periods?.["30"];
  cell(tr,metric?.clicks===null||metric?.clicks===undefined?"未取得":num(metric.clicks));
  for(const term of monitored){
   cell(tr,rank(findKeyword(record,term)?.current_30d?.position));
  }
  body.appendChild(tr);
 }
}
function exportHistory(){
 const records=Array.isArray(history?.entries)?history.entries.filter(valid):[];
 if(!records.length){$("seo-history-state").textContent="尚無可匯出的真實每日歷史。";return;}
 const safe=x=>{
  const str=String(x===null||x===undefined?"":x);
  return '"'+(/^[=+\-@\t\r]/.test(str)?"'":"")+str.replace(/"/g,'""')+'"';
 };
 const titles=["檢查日期","檢查時間","檢查狀態","GSC最新資料日","30天自然搜尋點擊","30天搜尋曝光","30天CTR",
   "室內設計排名30天","室內設計推薦排名30天","桃園室內設計排名30天"];
 const list=records.slice().sort((a,b)=>a.check_date.localeCompare(b.check_date));
 const csv=[titles,...list.map(r=>[
  r.check_date,r.checked_at,r.status,r.gsc_latest_day,r.periods?.["30"]?.clicks,
  r.periods?.["30"]?.impressions,r.periods?.["30"]?.ctr,
  ...monitored.map(t=>findKeyword(r,t)?.current_30d?.position)
 ])].map(row=>row.map(safe).join(",")).join("\r\n");
 const blob=new Blob(["\uFEFF",csv],{type:"text/csv;charset=utf-8"});
 const url=URL.createObjectURL(blob);const a=document.createElement("a");
 a.href=url;a.download="晨陽_GSC每日歷史_"+taiwanDay()+".csv";
 document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),1000);
}
async function getJson(name){
 const res=await fetch("./"+name,{cache:"no-store"});
 if(!res.ok)throw Error("HTTP "+res.status);
 return res.json();
}
async function refresh(){
 const today=await Promise.allSettled([getJson("seo-daily-check.json"),getJson("seo-daily-history.json")]);
 daily=today[0].status==="fulfilled"&&valid(today[0].value)?today[0].value:null;
 history=today[1].status==="fulfilled"&&today[1].value?.schema_version===1&&
   Array.isArray(today[1].value.entries)?today[1].value:null;
 renderCurrent();renderHistory();
}
document.addEventListener("DOMContentLoaded",()=>{
 const select=$("seo-history-filter"),exporter=$("seo-history-export");
 if(select)select.addEventListener("change",renderHistory);
 if(exporter)exporter.addEventListener("click",exportHistory);
 refresh();
 // Check only the already-published small public JSON, with zero vendor/API charges.
 window.setInterval(()=>{
   if(document.visibilityState==="visible"&&!$("view-seo").hidden)refresh();
 },300000);
});
})();
