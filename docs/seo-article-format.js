/* 晨陽官網文章的預覽與 HTML 複製共用排版。 */
(function(){
"use strict";
const headingGold="#C5A47E";
const legacyTextColors=new Set([
 "#c5a47e","rgb(197,164,126)","#add8e6","rgb(173,216,230)","#afeeee","rgb(175,238,238)",
 "lightblue","paleturquoise"
]);

function cleanArticleLabel(text){
 return String(text||"")
  .replace(/本專區使用(?:3D\s*建模示意圖|實景照片)說明設計方向，實際尺寸、材質及工程成果仍須以核准圖說與現場確認為準。/g,"")
  .replace(/（(?:3D\s*建模示意圖，非施工完成證明|平面配置圖，請以最終核准圖說為準)）/g,"")
  .replace(/；房間名稱、尺寸與實際配置應以原始核准圖面為準。/g,"。")
  .replace(/[｜|]\s*3D\s*建模示意圖/g,"")
  .replace(/3D\s*建模示意圖/g,"")
  .replace(/可見\s*。/g,"。");
}

function legacyTextColor(color){
 return legacyTextColors.has(color.toLowerCase().replace(/\s+/g,""));
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

window.formatChenyangArticleForCms=function(html){
 const template=document.createElement("template");
 template.innerHTML=html;
 const article=template.content;
 article.querySelectorAll(".chenyang-seo-draft-warning").forEach(node=>node.remove());
 restoreHeadingParagraphs(article);
 for(const node of article.querySelectorAll("[style],font[color],a")){
  if(node.closest("h2"))continue;
  if(legacyTextColor(node.style.color))node.style.removeProperty("color");
  if(node.hasAttribute("color")&&legacyTextColor(node.getAttribute("color")))node.removeAttribute("color");
  if(node.matches("a")&&!node.style.color)node.style.setProperty("color","inherit","important");
  if(node.getAttribute("style")==="")node.removeAttribute("style");
 }
 for(const heading of article.querySelectorAll("h2")){
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
 return template.innerHTML;
};
})();
