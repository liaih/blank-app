/* 晨陽 SEO 搜尋商機：前端使用者提供市場量 × 私人系統公開的 GSC 歷史彙總。
 * 所有 CSV 解析、比對只在瀏覽器記憶體執行，不對外傳輸、不保存至 GitHub。
 * 市場數據未提供時保持未知；不可把 GSC 曝光當全市場搜尋量。
 */
(function(){
"use strict";
const dom=id=>document.getElementById(id);
const num=n=>Number(n).toLocaleString("zh-TW",{maximumFractionDigits:1});
const simplify=s=>String(s??"").normalize("NFKC").trim().replace(/\s+/g,"").toLocaleLowerCase("zh-TW");
const hasData=n=>n!==null&&n!==undefined&&Number.isFinite(Number(n));
let snapshot=null;
let adsData=new Map();
let category="all";
let intent="all";
let sort="priority";
let importedMeta=null;

function classify(keyword){
 const word=String(keyword);
 if(/推薦|比較|評價|公司|費用|報價|價格|設計師/.test(word))return "比較／決策";
 if(/老屋|翻新|新成屋|裝潢|裝修|小宅|小坪數/.test(word))return "具體裝修需求";
 return "廣泛探索";
}
function region(keyword){
 const s=String(keyword);
 for(const value of ["桃園","中壢","南崁","林口","A7","竹北","新竹","台中","臺中","台南","臺南","高雄"]){
   if(s.includes(value))return value;
 }
 return "全台泛詞";
}
function decide(row,market){
 const rank=row.current_30d||{};
 const impression=rank.impressions;
 const position=rank.position;
 const interest=classify(row.keyword);
 if(hasData(impression)&&impression>=30&&hasData(position)&&position>10){
  return {label:"優先檢查排名",order:4,
   action:"核對此詞實際曝光的官網頁面、標題與搜尋意圖；確認是否需強化服務頁"};
 }
 if(hasData(impression)&&impression>=30&&hasData(position)&&position<=10){
  const ctr=hasData(rank.clicks)&&impression>0?rank.clicks/impression:null;
  if(ctr!==null&&ctr<=0.03){
   return {label:"優先檢查點擊率",order:4,
    action:"對照搜尋結果標題與摘要，檢查是否符合屋主提問"};
  }
 }
 if(hasData(impression)&&impression>=3){
  return {label:"已有曝光，持續觀察",order:3,action:"追蹤平均排名與頁面表現，累積足夠樣本"};
 }
 if(market&&interest!=="廣泛探索"){
  return {label:"有市場資料，待驗證",order:2,action:"先核對市場需求範圍，規劃對應服務頁，再追蹤 GSC"};
 }
 if(hasData(impression)&&impression>0){
  return {label:"曝光樣本極少",order:1,action:"目前無法可靠判定排名成效，繼續觀察"};
 }
 return {label:"待補市場與排名資料",order:0,
  action:interest==="廣泛探索"?"先核對市場搜尋量，避免只因通用詞就投入":"確認市場需求與服務區域，補足量測後再排優先序"};
}
function safeVolume(value){
 const raw=String(value??"").trim();
 if(!raw||raw==="—"||raw==="-")return null;
 const exact=raw.replace(/,/g,"");
 if(/^\d+(?:\.\d+)?$/.test(exact)){
  const v=Number(exact);
  if(!Number.isFinite(v)||v>1e9)throw Error("搜尋量超出合理範圍");
  return {kind:"exact",value:v,label:num(v)};
 }
 // Google Ads may export broad bands depending on account access.
 const match=raw.match(/^\s*([\d,.]+)\s*([KkMm萬千]?)\s*[-–~至]\s*([\d,.]+)\s*([KkMm萬千]?)\s*$/);
 if(match){
  const multiplier=x=>x==="k"||x==="K"||x==="千"?1000:x==="m"||x==="M"?1000000:x==="萬"?10000:1;
  const a=Number(match[1].replace(/,/g,""))*multiplier(match[2]);
  const b=Number(match[3].replace(/,/g,""))*multiplier(match[4]);
  if(Number.isFinite(a)&&Number.isFinite(b)&&a>=0&&a<=b&&b<=1e9){
   return {kind:"range",low:a,high:b,label:num(a)+"–"+num(b)+"（區間）"};
  }
 }
 throw Error("無法解析搜尋量："+raw.slice(0,40)+"；請使用數字或 100–1K 區間");
}
function parseCsv(text){
 if(text.length>2_000_000)throw Error("檔案過大，請匯入 2MB 以下的 CSV");
 const result=[];
 let row=[],field="",inside=false;
 for(let i=0;i<text.length;i++){
  const c=text[i];
  if(inside){
   if(c==='"'&&text[i+1]==='"'){field+='"';i++;}
   else if(c==='"'){inside=false;}
   else field+=c;
  }else if(c==='"'){inside=true;}
  else if(c===','){row.push(field);field="";}
  else if(c==='\n'||c==='\r'){
   if(c==='\r'&&text[i+1]==='\n')i++;
   row.push(field);if(row.some(v=>v.trim()))result.push(row);
   row=[];field="";
  }else field+=c;
 }
 if(inside)throw Error("CSV 引號未閉合");
 row.push(field);if(row.some(v=>v.trim()))result.push(row);
 if(result.length>2100)throw Error("只接受至多 2,000 筆關鍵字");
 return result;
}
function normalizeHeader(x){return String(x).replace(/^\uFEFF/,"").normalize("NFKC").replace(/[\s._-]/g,"").toLowerCase();}
const keywordHeaders=["keyword","keywords","searchterm","關鍵字","关键词","搜尋字詞"];
const volumeHeaders=["avgmonthlysearches","average monthly searches","avg monthly searches","平均每月搜尋量","每月平均搜尋量","平均月搜尋量","平均月搜索量","平均每月搜索量"];
function parseAdsCsv(text){
 const lines=parseCsv(text);
 let headerIndex=-1,kindex=-1,vindex=-1;
 for(let i=0;i<Math.min(20,lines.length);i++){
  const keys=lines[i].map(normalizeHeader);
  const ki=keys.findIndex(k=>keywordHeaders.map(normalizeHeader).includes(k));
  const vi=keys.findIndex(k=>volumeHeaders.map(normalizeHeader).includes(k));
  if(ki>=0&&vi>=0){headerIndex=i;kindex=ki;vindex=vi;break;}
 }
 if(headerIndex<0)throw Error("找不到「關鍵字」與「平均每月搜尋量」欄位，請使用 Google Ads 匯出或 CSV 範本");
 const temp=new Map();
 let ignored=0,accepted=0;
 for(const cells of lines.slice(headerIndex+1)){
  const word=String(cells[kindex]??"").trim();
  if(!word){ignored++;continue;}
  const vol=safeVolume(cells[vindex]);
  if(!vol){ignored++;continue;}
  const key=simplify(word);
  if(temp.has(key))throw Error("發現重複關鍵字："+word+"；避免重複計算，請先清理 CSV");
  temp.set(key,vol);accepted++;
 }
 if(!accepted)throw Error("沒有可匯入的有效市場搜尋量");
 return {data:temp,accepted,ignored};
}
function draw(){
 if(!snapshot)return;
 const tracked=snapshot.seo.keyword_rankings?.rows||[];
 let list=tracked.map(row=>{
  const market=adsData.get(simplify(row.keyword))||null;
  return {row,market,intent:classify(row.keyword),region:region(row.keyword),
          conclusion:decide(row,market)};
 });
 const sourced=tracked.filter(r=>adsData.has(simplify(r.keyword))).length;
 dom("market-tracked").textContent=num(tracked.length)+" 組";
 dom("market-gsc").textContent=num(tracked.filter(r=>hasData(r.current_30d?.impressions)&&r.current_30d.impressions>0).length)+" 組";
 dom("market-external").textContent=sourced?num(sourced)+" 組":"尚無資料";
 dom("market-urgent").textContent=num(list.filter(r=>r.conclusion.order===4).length)+" 組";
 dom("market-source-state").textContent=importedMeta?
  "已由瀏覽器暫時載入："+importedMeta.accepted+" 組（其中 "+sourced+" 組與追蹤詞相符）｜地區："+importedMeta.geo+"｜期間："+importedMeta.period:
  "尚未取得全市場搜尋量；目前優先方向只依 GSC 與搜尋意圖判定";
 list=list.filter(item=>(category==="all"||item.row.category===category)&&(intent==="all"||item.intent===intent));
 list.sort((a,b)=>{
  if(sort==="gsc")return (b.row.current_30d?.impressions??-1)-(a.row.current_30d?.impressions??-1);
  if(sort==="market"){
   const av=a.market?.kind==="exact"?a.market.value:-1;
   const bv=b.market?.kind==="exact"?b.market.value:-1;
   return bv-av||b.conclusion.order-a.conclusion.order;
  }
  return b.conclusion.order-a.conclusion.order||
    (b.row.current_30d?.impressions??-1)-(a.row.current_30d?.impressions??-1);
 });
 const body=dom("market-rows");body.replaceChildren();
 if(!list.length){
  const tr=document.createElement("tr"),td=document.createElement("td");
  td.colSpan=9;td.textContent="目前篩選條件下沒有資料";tr.append(td);body.append(tr);
 }
 for(const item of list){
  const current=item.row.current_30d||{};
  const fields=[
   item.row.keyword,item.intent,item.region,
   item.market?item.market.label:"待取得",
   hasData(current.impressions)?num(current.impressions):"未取得",
   hasData(current.position)?Number(current.position).toFixed(1)+" 名":"未取得",
   "尚未串接名單／成交",item.conclusion.label,item.conclusion.action
  ];
  const tr=document.createElement("tr");
  fields.forEach((value,i)=>{
   const td=document.createElement("td");td.textContent=value;
   if(i===3||i===4||i===5)td.className="num";
   if(i===7){const span=document.createElement("span");span.className="label"+(item.conclusion.order>=4?" wait":"");span.textContent=value;td.replaceChildren(span);}
   tr.append(td);
  });body.append(tr);
 }
 dom("market-footnote").textContent=importedMeta?
  "目前匯入是使用者提供的檔案，未由 Google API 驗證。只在這個瀏覽器頁面記憶體使用，重新整理會清除，並不會寫入 GitHub 或私人資料庫。":
  "「市場搜尋量」還沒有外部資料，所有「待取得」都是未知，不是搜尋量為 0。";
}
function init(){
 const input=dom("market-file");
 const status=dom("market-upload-status");
 for(const id of ["market-category","market-intent","market-sort"]){
  dom(id).addEventListener("change",()=>{
   category=dom("market-category").value;
   intent=dom("market-intent").value;
   sort=dom("market-sort").value;draw();
  });
 }
 dom("market-template").addEventListener("click",()=>{
  const csv="keyword,avg_monthly_searches\r\n室內設計,\r\n桃園室內設計,\r\n";
  const blob=new Blob(["\uFEFF"+csv],{type:"text/csv;charset=utf-8"});
  const url=URL.createObjectURL(blob);
  const a=document.createElement("a");a.href=url;a.download="SEO市場搜尋量_空白範本.csv";
  a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
 });
 input.addEventListener("change",async()=>{
  const file=input.files?.[0];if(!file)return;
  const geo=dom("market-geo").value.trim();
  const period=dom("market-period").value.trim();
  if(!geo||!/\d{4}-\d{2}/.test(period)){
   status.textContent="先填寫原始報表使用的地區及資料月份，再匯入檔案。";
   input.value="";return;
  }
  if(file.size>2_000_000){status.textContent="檔案超過 2MB，拒絕載入";input.value="";return;}
  try{
   const parsed=parseAdsCsv(await file.text());
   adsData=parsed.data;
   importedMeta={accepted:parsed.accepted,ignored:parsed.ignored,geo,period,filename:file.name};
   status.textContent="已在此頁暫時載入 "+parsed.accepted+" 組市場搜尋量；來源為使用者提供的 CSV，尚未獨立驗證。";
   draw();
  }catch(error){
   status.textContent="匯入失敗："+String(error.message||"格式不符");
   adsData=new Map();importedMeta=null;draw();
  }
  input.value="";
 });
 dom("market-clear").addEventListener("click",()=>{
  adsData.clear();importedMeta=null;status.textContent="已清除本次瀏覽器內的外部市場資料";draw();
 });
}
window.MarketOpportunity={init,render:(data)=>{snapshot=data;draw();},parseAdsCsv,classify,region,decide};
})();
