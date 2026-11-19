/* 晨陽官網文章的預覽與 HTML 複製共用排版。 */
(function(){
"use strict";
const headingGold="#C5A47E";
const contactUrl="https://www.chen-yang.com.tw/contact.php";
// Editorial summaries of the corresponding article and its existing draft.
// Proposal images, known measurements and completed works are described separately.
const caseBriefs={
 "seo-danfo-234":["林口 A7 丹佛花都裝潢，客餐廳動線和次臥怎麼規劃？","在有限的面積裡，餐椅拉開、冰箱開門和從玄關走進客廳，可能同時發生。次臥若要兼書房，還要先決定是否會加床。","原文有格局圖及室內設計新提案。圖文可對照一字型廚房鄰近餐桌的配置，以及次臥的書桌和收納安排。","先把餐桌、冰箱與常走的路線畫在同一張圖，再決定玄關收納深度。","次臥有工作與過夜需求時，現場量桌深、床位與開門後的淨寬。"],
 "seo-yunjiang-331":["林口 A7 允將大聚裝潢，玄關收納和毛孩動線怎麼安排？","外出用品、掃地機器人與毛孩都會使用客餐廳附近的空間。屋主可先畫出每天實際怎麼走、拿什麼。","原文保留 L 戶與 A 戶兩組平面資料。L 戶的提案有集中式玄關收納，並安排毛孩通行與清潔設備的停靠位置。","把鞋、外出物品及清潔設備集中在容易取用的位置，替人和毛孩保留各自的通行空間。","不同戶型應依櫃體深度、開門位置與插座逐一核對。"],
 "seo-hongguang-253":["林口 A7 鴻廣繪青北歐風裝潢，旅行收藏放哪裡才整齊？","在客廳展示兩人的紀念品時，先想清楚哪些要常看、哪些要輪替，以及展示區會不會壓縮日常收納。","原文的設計提案以沙發背牆的世界地圖呼應旅行收藏，並用自然木紋與奶茶色藝術漆整理公區的視覺層次。","集中在同一面主牆展示，留出可以更換藏品的方式，其餘用品回到日常收納的位置。","丈量前先整理藏品尺寸，再核對壁面固定、展示照明與清潔需求。"],
 "seo-fumei-503":["新莊福美富琚做美式現代風，如何同時保留收納和走道？","想保留乾淨的線板與木色調時，電視櫃和衣櫃仍要能收家電、衣物，開門後也要留走道。","原文的美式現代提案有淺灰藝術漆電視牆、白色長型電視櫃，以及整合層板與抽屜的頂天衣櫃。","先以收納分類和家具尺度決定櫃體，再搭配客廳淺色牆面、木地板和臥室局部線板。","放樣時可核對櫃門開啟、插座、照明與床邊通道。"],
 "seo-lixuan-217":["林口立軒天諾三房裝潢，哪一間房該保留彈性？","孩子成長、居家工作和親友留宿都可能改變居住需求。可先找出用途最容易變動的一間房。","原文收錄 A1 戶的三房兩廳平面規劃。這張圖可用來對照房間位置與開門方向。","先安排每天都要用的床位、衣櫃與走道；用途可能變動的房間可留活動家具或兼用空間。","施工前依實際圖說及丈量核對門、櫃和家具的開啟範圍。"],
 "seo-housheng-451":["中壢 A20 厚陞晴北歐風裝潢，如何規劃收納又保留採光？","客廳需要收常用用品，臥室也要容納衣物與床邊照明，可以從兩個空間的使用動線一起畫圖。","原文的空間提案以淺色搭配木質櫃體。客廳配置大面窗與較輕透的窗簾，臥室則整合衣櫃和床頭使用需求。","把常用物品集中收納，留出窗前採光和走道，再安排床邊照明、開關、插座。","放樣時量電視牆長度及衣櫃深度，核對拉開櫃門後的床邊通行。"],
 "ai-kaohsiung-536":["高雄仁武星河畔小宅，要怎麼兼顧書房、客房和收納？","小宅同一間房可能要兼工作、臨時留宿或運動。先列出最常用的情境，再決定哪些家具要能移動。","原文的空間提案提到玄關懸浮收納與以隔間簾區隔的多功能空間，兩處分別解決進門置物與彈性使用。","把外出用的小物集中在玄關，在多功能區以隔間簾與系統櫃整理不同需求。","確認工作桌使用時、客人留宿時與收起隔間簾後，各有多少活動空間。"],
 "seo-oldhouse-614":["25 坪老屋翻新要先改格局嗎？30 年公寓如何安排工程和收納？","老公寓有漏水、管線老化或收納不足時，可先釐清要處理的屋況，再評估是否值得動隔間。","原文記錄此案約 25 坪、屋齡 30 年，保留原有兩房兩廳兩衛；沿牆櫃體整合玄關與餐廚。","先核對基礎工程、管線與窗台漏水的銜接，再以沿牆櫃體增加收納。","現場勘查時把漏水原因、工程分工、電器尺寸與散熱需求列入確認。"],
 "url-news-182":["土城金城舞兩房怎麼比？先看餐桌和走道能否共用","同樣是兩房配置，玄關開門、冰箱位置與餐桌拉椅後的距離，會影響每天的通行。","原文列有 D6、D2、C10 三組平面圖，可以用同一套家具尺寸做對照。","將平面圖轉至相同方向，標出玄關、冰箱、餐桌及椅子拉開的範圍。","餐桌兼工作桌時，同時確認用電位置與用餐時的通行空間。"],
 "url-news-564":["台南豪棋 MOMA18 怎麼做無主燈？客廳與臥室要看哪些條件？","看電視、閱讀與夜間起身需要的光線不同。白天的窗邊眩光也會影響座位及電視的位置。","原文以客廳無主燈及臥室遮光，說明不同空間的用光方向。","按照家具位置安排日光與分區照明，依使用情境分配亮度。","定案前先核對天花高度、燈具維修方式、迴路及用電位置。"],
 "url-news-83":["桃園青和寬逸三面採光，家具和收納怎麼放才不擋光？","窗多的住宅仍需要收納與隱私。可先看什麼時段會在客廳、書桌或餐桌停留。","原文記載建案採三面採光，頁面也附有格局配置資料供對照。","平面圖上先標窗面、開窗方向及窗簾，再為高櫃找出與窗戶錯開的位置。","書桌、餐桌和沙發定案前，核對窗扇、房門及椅子移動時的空間。"],
 "url-news-473":["北屯浩瀚創立方挑高空間怎麼規劃？先核對用途、收納與動線","看到挑高格局時，可以先釐清實際使用用途，並確認樓高、家具和固定櫃體的關係。","原文提到全案包含一般事務所及店面規劃，也附有平面資料。用途及施工限制需依自家戶別的正式文件確認。","先畫入口、辦公或使用區與收納的走道，依實際動線配置家具。","使用用途、淨高與固定設備位置，應在丈量及確認圖說後定案。"],
 "url-news-170":["竹北王喬光知樹透天裝潢，如何安排樓層動線與採光？","三代同住時，樓層分配、家庭活動及日常上下樓的習慣，都會影響每層需要的機能。","原文介紹雙天井設計，並提供不同樓層的平面規劃圖供對照。","分樓層畫出日常動線，優先保留天井周邊的採光、通行與清潔空間。","若涉及設備或管線變更，需確認圖面、現場位置與可調整範圍。"],
 "url-news-423":["泰山碧瑤一品雋想做工業風，家具、收納和動線要先定什麼？","先列出客餐廳的日常活動，才能決定哪些家具要保留、哪裡需要集中收納。","原文保留 C 戶格局與工業風設計提案，可對照圖片中的空間分區及家具位置。","把沙發、餐桌與櫃體畫到原平面圖上，再依通行和收納需求決定風格細節。","下單前依戶別尺寸確認開門、拉椅、取物時能否順利通過。"],
};

function cleanArticleLabel(text){
 return String(text||"")
  .replace(/本專區使用(?:3D\s*建模示意圖|實景照片)說明設計方向，實際尺寸、材質及工程成果仍須以核准圖說與現場確認為準。/g,"")
  .replace(/（(?:3D\s*建模示意圖，非施工完成證明|平面配置圖，請以最終核准圖說為準)）/g,"")
  .replace(/；房間名稱、尺寸與實際配置應以原始核准圖面為準。/g,"。")
  .replace(/[【（(]\s*3D\s*(?:建模|案場|模擬|空間)?\s*示意圖\s*[】）)]/gi,"")
  .replace(/[｜|]\s*3D\s*建模示意圖/g,"")
  .replace(/3D\s*建模示意圖/g,"")
  .replace(/可見\s*。/g,"。");
}

function restoreHeadingParagraphs(article){
 for(const heading of article.querySelectorAll("h2")){
  const children=[...heading.childNodes];
  const paragraphStart=children.find(node=>{
   if(node.nodeType!==Node.ELEMENT_NODE)return false;
   const size=node.style.fontSize;
   const text=node.textContent.trim();
   return (size==="18px"||size==="16px")&&text.length>=30&&/[，。；]/.test(text);
  });
  if(!paragraphStart)continue;
  const paragraph=document.createElement("p");
  paragraph.style.cssText="font-size:18px;line-height:1.9;margin:0 0 18px";
  const index=children.indexOf(paragraphStart);
  paragraph.append(...children.slice(index));
  if(heading.textContent.trim()||heading.querySelector("img,iframe,video")){
   heading.after(paragraph);
  }else{
   if(heading.id)paragraph.id=heading.id;
   heading.replaceWith(paragraph);
  }
 }
}

function normalizeBodyHeadings(article){
 const labels=/^(?:建案基本資料|建案資訊|基本資料|案情基本資訊|生活區位|生活機能與特色|生活機能|格局規劃|空間亮點整理|常見問題(?:\s*FAQ)?|延伸閱讀)$/i;
 for(const old of article.querySelectorAll("h1,p")){
  if(old.tagName==="P"&&(!labels.test(old.textContent.trim())||old.querySelector("a,img,video,iframe")))continue;
  const heading=document.createElement("h2");
  for(const attr of old.attributes)heading.setAttribute(attr.name,attr.value);
  heading.append(...old.childNodes);old.replaceWith(heading);
 }
}

function faqEntries(draft){
 const entry=draft?.sections?.find(section=>/FAQ|常見問題/i.test(section[0]));
 const lines=String(entry?.[1]||"").split(/<br\s*\/?>|\n/i).map(line=>line.trim()).filter(Boolean);
 const questions=[];
 for(let i=0;i+1<lines.length;i+=2){
  const question=lines[i].replace(/^Q\s*\d*\s*[：:.、]\s*/i,"");
  if(!/[？?]$/.test(question))continue;
  questions.push([question,lines[i+1].replace(/^A\s*\d*\s*[：:.、]\s*/i,"")]);
 }
 return questions;
}
function articleBrief(draft,media,article){
 if(caseBriefs[draft?.id])return caseBriefs[draft.id];
 const question=faqEntries(draft)[0];
 const project=draft?.project_name||draft?.title?.split(/[｜|]/)[0]?.trim();
 if(!question||!project)return null;
 const guidance=draft.sections.at(-2);
 const excerpt=[...article.querySelectorAll("p")].map(node=>node.textContent.trim().replace(/\s+/g," "))
  .map(text=>text.match(/^.{24,130}?[。！？]/u)?.[0]||"")
  .find(text=>text&&!/^(?:延伸閱讀|►|▶|所有圖片|請點|歡迎|Q[：:])/i.test(text));
 const plans=Number(media?.preservation_audit?.floorplan_count||0);
 const evidence=[excerpt,plans>0?"原文附有格局或平面配置圖，可用來比對空間分區及開門位置。":""].filter(Boolean).join(" ");
 return [project+"｜"+question[0],guidance?.[0]||question[0],evidence,question[1],
  "規劃前備妥原始圖面、現況照片與家具尺寸，跟設計師核對自家條件。"];
}
function appendText(parent,tag,content){
 const node=document.createElement(tag);
 node.textContent=content;
 parent.appendChild(node);
 return node;
}
function addEditorialSections(article,draft,media){
 const brief=articleBrief(draft,media,article);
 if(!brief)return;
 const [,situation,evidence,solution,verify]=brief;
 const intro=document.createElement("section");
 intro.setAttribute("data-chenyang-aeo","1");
 appendText(intro,"h2","重點先看");
 const highlights=document.createElement("ul");intro.appendChild(highlights);
 for(const point of [solution,verify,evidence||situation])appendText(highlights,"li",point);
 intro.appendChild(document.createElement("hr"));
 appendText(intro,"h2","屋主會遇到的問題");
 appendText(intro,"p",situation);
 if(evidence){
  appendText(intro,"h2","本案圖面與設計資料");
  appendText(intro,"p",evidence);
 }
 appendText(intro,"h2","晨陽的規劃與核對方式");
 appendText(intro,"p",solution+" "+verify);
 intro.appendChild(document.createElement("hr"));
 const hasFaq=[...article.querySelectorAll("h2,h3,h4,p,li,strong,b")]
  .some(node=>/^(?:常見問題|FAQ\b|Q\s*\d*\s*[：:.、].{3,}[？?])/i.test(node.textContent.trim()));
 const questions=hasFaq?[]:faqEntries(draft);
 if(questions.length){
  appendText(article,"h2","常見問題 FAQ");
  for(const [question,answer] of questions){appendText(article,"h3",question);appendText(article,"p",answer);}
 }
 const officialLinks=new Set([...article.querySelectorAll("a[href]")].flatMap(link=>{
  try{
   const url=new URL(link.getAttribute("href"),contactUrl);
   return ["www.chen-yang.com.tw","chen-yang.com.tw"].includes(url.hostname)?[url.pathname]:[];
  }catch(_){return [];}
 }));
 if(!officialLinks.has("/contact.php")){
  article.appendChild(document.createElement("hr"));
  appendText(article,"h2","準備你的裝修規劃");
  appendText(article,"p","備妥平面圖、現況照片與最想改善的空間，和晨陽設計討論適合自家條件的做法。");
  appendText(appendText(article,"p",""),"a","聯絡晨陽設計").setAttribute("href",contactUrl);
 }
 const related=[["/service.php","晨陽設計服務流程"],["/unboxing.php","更多晨陽案例開箱"]]
  .filter(([path])=>!officialLinks.has(path));
 if(related.length){
  article.appendChild(document.createElement("hr"));
  appendText(article,"h2",/延伸閱讀/.test(article.textContent)?"相關頁面":"延伸閱讀");
  const links=document.createElement("ul");article.appendChild(links);
  for(const [path,label] of related)appendText(appendText(links,"li",""),"a",label).setAttribute("href",new URL(path,contactUrl).href);
 }
 article.prepend(intro);
}

window.formatChenyangArticleForCms=function(html,{draft,media}={}){
 const template=document.createElement("template");
 template.innerHTML=html;
 const article=template.content;
 let body=article.firstElementChild;
 if(!body?.matches('[data-chenyang-article-format="2"]')||body.nextElementSibling){
  body=document.createElement("div");
  body.setAttribute("data-chenyang-article-format","2");
  body.append(...article.childNodes);
  article.appendChild(body);
 }
 body.style.cssText="color:#333333;font-size:18px;line-height:1.9";
 article.querySelectorAll(".chenyang-seo-draft-warning,script,style,link[rel=stylesheet]").forEach(node=>node.remove());
 normalizeBodyHeadings(article);
 restoreHeadingParagraphs(article);
 if(!body.querySelector("[data-chenyang-aeo]"))addEditorialSections(body,draft,media);
 for(const node of article.querySelectorAll("p,li,dt,dd")){
  if(node.closest("figure,figcaption,h2,h3,h4,h5,h6"))continue;
  node.style.setProperty("font-size","18px","important");
  node.style.setProperty("line-height","1.9","important");
 }
 for(const node of article.querySelectorAll("[style],font[color],a")){
  if(node===body||node.closest("h2,h3,h4,h5,h6"))continue;
  if(node.style.color!=="rgb(51, 51, 51)")node.style.removeProperty("color");
  if(node.matches("font[color]"))node.removeAttribute("color");
  if(node.closest("p,li,dt,dd")&&!node.closest("figcaption")&&node.style.fontSize)node.style.setProperty("font-size","18px","important");
  if(node.matches("a"))node.style.setProperty("color","inherit","important");
  if(node.getAttribute("style")==="")node.removeAttribute("style");
 }
 for(const node of article.querySelectorAll("figcaption"))node.style.setProperty("color","#666666","important");
 for(const heading of article.querySelectorAll("h2,h3,h4,h5,h6")){
  heading.style.setProperty("color",headingGold,"important");
  heading.style.setProperty("font-size","20px","important");
  heading.style.setProperty("line-height","1.9","important");
  heading.style.setProperty("font-weight","700","important");
  for(const child of heading.querySelectorAll("span,strong,b,a,font,[style]")){
   child.style.setProperty("color",headingGold,"important");
   child.style.setProperty("font-size","20px","important");
   child.style.setProperty("line-height","1.9","important");
   child.style.setProperty("font-weight","700","important");
  }
 }
 for(const img of article.querySelectorAll("img[alt]")){
  img.setAttribute("alt",cleanArticleLabel(img.getAttribute("alt")));
 }
 const walker=document.createTreeWalker(article,NodeFilter.SHOW_TEXT);
 while(walker.nextNode()){
  const node=walker.currentNode;
  if(!node.parentElement?.closest("style,script"))node.textContent=cleanArticleLabel(node.textContent);
 }
 for(const heading of article.querySelectorAll("h2,h3,h4,h5,h6")){
  if(!heading.textContent.trim()&&!heading.querySelector("img,iframe,video,a,[id]")&&!heading.id)heading.remove();
 }
 return template.innerHTML;
};

window.chenyangArticleTitle=function(draft){
 const brief=caseBriefs[draft?.id];
 if(brief)return brief[0];
 const question=faqEntries(draft)[0];
 const project=draft?.project_name||draft?.title?.split(/[｜|]/)[0]?.trim();
 return question&&project?project+"｜"+question[0]:draft?.title;
};
})();
