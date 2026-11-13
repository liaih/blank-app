const {test}=require("node:test");
const assert=require("node:assert/strict");
const fs=require("node:fs");
const crypto=require("node:crypto");
const {JSDOM}=require("jsdom");

const script=fs.readFileSync("docs/seo-case-expansion.js","utf8");
const baseline='<h2>丹佛花都原建案介紹</h2><p>原 D11 戶仍保留，不得覆寫</p>'+
  '<img src="https://chen-yang.com.tw/upload/images/old-D11-floorplan.jpg" alt="D11 原格局圖">'+
  '<img src="https://chen-yang.com.tw/upload/images/old-D11-render.jpg" alt="D11 原示意圖">';
const media={articles:[{id:"seo-danfo-234",html_with_media:baseline,media_integrated:true,
  floorplan_protection_passed:true,floorplan_count:1,preservation_audit:{original_main_content_preserved:true}}]};
const drafts={articles:[{id:"seo-danfo-234",project_name:"丹佛花都",title:"丹佛花都｜林口A7"}]};
const library=JSON.parse(fs.readFileSync("docs/seo-known-visual-descriptions.json","utf8"));
async function setup(){
  const dom=new JSDOM('<html><body><div id="case-expansion"></div></body></html>',{runScripts:"outside-only",url:"https://liaih.github.io/blank-app/monitor.html"});
  Object.defineProperty(dom.window.crypto,"subtle",{value:crypto.webcrypto.subtle});
  dom.window.URL.createObjectURL=()=>"blob:https://liaih.github.io/placeholder";
  dom.window.URL.revokeObjectURL=()=>{};
  dom.window.fetch=async url=>({ok:true,json:async()=>String(url).includes("seo-media-rewrites")?media:
    String(url).includes("seo-rewrites")?drafts:library});
  dom.window.eval(script);
  await new Promise(r=>setTimeout(r,20));
  return dom;
}
async function fileSelect(dom,name){
  const bytes=new TextEncoder().encode(name);
  const f=new dom.window.File([bytes],name,{type:"image/png"});
  f.arrayBuffer=async()=>bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.byteLength);
  const input=dom.window.document.querySelector("#cyexp-files");
  Object.defineProperty(input,"files",{value:[f],configurable:true});
  input.dispatchEvent(new dom.window.Event("change",{bubbles:true}));
  await new Promise(r=>setTimeout(r,55));
}
function edit(dom,node,value,kind="input"){
  node.value=value;
  node.dispatchEvent(new dom.window.Event(kind,{bubbles:true}));
}
function check(dom,node){
  node.checked=true;node.dispatchEvent(new dom.window.Event("change",{bubbles:true}));
}
function status(dom){
  return dom.window.document.querySelector("#cyexp-status").textContent;
}
test("new case cannot export without new floorplan, even when other photos pass",async()=>{
  const dom=await setup();const d=dom.window.document;
  edit(dom,d.querySelector("#cyexp-unit"),"新案 Z2");
  await fileSelect(dom,"living.png");
  const row=d.querySelector(".cyexp-item");
  edit(dom,row.querySelector('[data-attr="description"]'),"客廳淺木色電視櫃與白色沙發");
  edit(dom,row.querySelector('[data-attr="alt"]'),"丹佛花都｜新案 Z2 客廳3D示意圖");
  edit(dom,row.querySelector('[data-attr="url"]'),"https://chen-yang.com.tw/upload/images/new-living.png");
  check(dom,row.querySelector('[data-attr="verified"]'));
  edit(dom,d.querySelector("#cyexp-intro"),"新案 Z2 室內設計示意圖，保留原案");
  for(const id of ["cyexp-confirm-base","cyexp-confirm-urls","cyexp-confirm-floorplan"]){check(dom,d.querySelector("#"+id));}
  assert.match(status(dom),/缺少新的平面配置圖／格局圖/);
  assert.equal(d.querySelector("#cyexp-copy").disabled,true);
  assert.match(d.querySelector("#cyexp-html").value,/禁止輸出/);
  dom.window.close();
});
test("verified plan and rendered images export one safe original-plus-new HTML with ALT",async()=>{
  const dom=await setup();const d=dom.window.document;
  edit(dom,d.querySelector("#cyexp-unit"),"新案 Z2");
  await fileSelect(dom,"living.png");
  await fileSelect(dom,"新格局圖.png");
  const rows=d.querySelectorAll(".cyexp-item");
  assert.equal(rows.length,2);
  const config=[
    ["https://chen-yang.com.tw/upload/images/new-living.png","客廳淺木色電視櫃與白色沙發","丹佛花都｜新案Z2客廳3D建模示意圖"],
    ["https://chen-yang.com.tw/upload/images/new-floorplan.png","此為實際新增案圖說，需核對戶別","丹佛花都｜新案Z2平面配置圖"]
  ];
  rows.forEach((row,i)=>{
    const [url,description,alt]=config[i];
    edit(dom,row.querySelector('[data-attr="description"]'),description);
    edit(dom,row.querySelector('[data-attr="alt"]'),alt);
    edit(dom,row.querySelector('[data-attr="url"]'),url);
    check(dom,row.querySelector('[data-attr="verified"]'));
  });
  edit(dom,d.querySelector("#cyexp-intro"),"本次新增新案Z2空間設計圖說與3D示意。");
  for(const id of ["cyexp-confirm-base","cyexp-confirm-urls","cyexp-confirm-floorplan"]){check(dom,d.querySelector("#"+id));}
  assert.equal(d.querySelector("#cyexp-copy").disabled,false,status(dom));
  const html=d.querySelector("#cyexp-html").value;
  assert.ok(html.startsWith(baseline));
  assert.match(html,/new-floorplan\.png/);
  assert.match(html,/新案Z2平面配置圖/);
  assert.match(html,/old-D11-floorplan\.jpg/);
  assert.match(html,/3D 建模示意圖/);
  const originalCount=(baseline.match(/<img/g)||[]).length;
  assert.equal((html.match(/<img/g)||[]).length,originalCount+2);
  assert.match(status(dom),/新格局圖 1 張/);
  dom.window.close();
});
test("image URLs cannot be blob/data/external and names are HTML-escaped",async()=>{
  const dom=await setup();const d=dom.window.document;
  edit(dom,d.querySelector("#cyexp-unit"),'B2"<script>alert(1)</script>');
  await fileSelect(dom,"新格局圖.png");
  const row=d.querySelector(".cyexp-item");
  edit(dom,row.querySelector('[data-attr="description"]'),"一張平面配置圖");
  edit(dom,row.querySelector('[data-attr="alt"]'),"丹佛花都 B2 格局圖");
  edit(dom,row.querySelector('[data-attr="url"]'),"https://not-chen-yang.com.tw/img.png");
  check(dom,row.querySelector('[data-attr="verified"]'));
  edit(dom,d.querySelector("#cyexp-intro"),"新案");
  for(const id of ["cyexp-confirm-base","cyexp-confirm-urls","cyexp-confirm-floorplan"]){check(dom,d.querySelector("#"+id));}
  assert.equal(d.querySelector("#cyexp-copy").disabled,true);
  assert.match(status(dom),/有效的晨陽官網 HTTPS 圖片網址/);
  dom.window.close();
});
test("user-provided nine image hashes are all present, original bytes not stored",()=>{
  assert.equal(library.matched_images.length,9);
  assert.equal(new Set(library.matched_images.map(x=>x.sha256)).size,9);
  assert.ok(library.matched_images.every(x=>x.description&&x.alt_suffix&&x.zone));
  assert.ok(!JSON.stringify(library).includes("data:image"));
});

test("batch paste URL maps by file order and resets URL verification",async()=>{
  const dom=await setup();const d=dom.window.document;
  await fileSelect(dom,"living.png");await fileSelect(dom,"新格局圖.png");
  const bulk=d.querySelector("#cyexp-bulk-urls");
  edit(dom,bulk,"https://chen-yang.com.tw/upload/images/new-living.png\nhttps://chen-yang.com.tw/upload/images/new-layout.png");
  check(dom,d.querySelector("#cyexp-confirm-urls"));
  d.querySelector("#cyexp-apply-urls").click();
  const links=[...d.querySelectorAll(".cyexp-item [data-attr=url]")].map(x=>x.value);
  assert.deepEqual(links,["https://chen-yang.com.tw/upload/images/new-living.png",
                          "https://chen-yang.com.tw/upload/images/new-layout.png"]);
  assert.equal(d.querySelector("#cyexp-confirm-urls").checked,false);
  dom.window.close();
});
