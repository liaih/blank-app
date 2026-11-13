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

test("public ALT and section headings avoid unneeded unit names while retaining exact visual labels",async()=>{
  const dom=await setup();const d=dom.window.document;
  edit(dom,d.querySelector("#cyexp-unit"),"內部專用-Z2");
  await fileSelect(dom,"living.png");
  await fileSelect(dom,"新格局圖.png");
  for(let i=0;i<2;i++){
    // The UI re-renders an item when its image category changes.
    let a=d.querySelectorAll(".cyexp-item")[i];
    edit(dom,a.querySelector('[data-attr="description"]'),i===0?"淺木色收納櫃、白色沙發與開放客餐廳":"住宅平面配置及空間動線","change");
    a=d.querySelectorAll(".cyexp-item")[i];
    edit(dom,a.querySelector('[data-attr="role"]'),i===1?"格局圖":"客廳","change");
  }
  // Readable drafting metadata, not mandatory public ALT or headlines.
  const altLabels=[...d.querySelectorAll('.cyexp-item [data-attr="alt"]')];
  assert.equal(altLabels.length,2);
  assert.ok(altLabels.every(input=>!input.value.includes("內部專用-Z2")));
  assert.ok(altLabels.every(input=>input.value.includes("丹佛花都")));
  assert.ok(altLabels.every(input=>input.value.includes("晨陽設計")));
  assert.ok(altLabels.some(input=>input.value.includes("平面配置圖")));
  dom.window.close();
});

test("browser image recognition uses documented Transformers.js image-to-text task and a compatible vision model",()=>{
  assert.match(script,/mod\.pipeline\("image-to-text","Xenova\/vit-gpt2-image-captioning"\)/);
  assert.match(script,/S\.transformers\.pipeline\("translation","Xenova\/opus-mt-en-zh"\)/);
  assert.match(script,/await pipe\(a\.preview,\{max_new_tokens:70\}\)/);
  assert.doesNotMatch(script,/\.pipeline\("image-text-to-text"/);
  assert.doesNotMatch(script,/await pipe\(messages/);
});
test("perceptual image reference matching has distinct reference hashes and never auto-approves captions",()=>{
  const hashes=library.matched_images.map(x=>x.dhash_v1);
  assert.equal(hashes.length,9);
  assert.ok(hashes.every(x=>/^[a-f0-9]{16}$/.test(x)));
  assert.equal(new Set(hashes).size,9);
  assert.match(script,/ranked\[0\]\?\.diff<=7/);
  assert.match(script,/a\.verified=false;return true/);
});

test("user-initiated LM Studio connects only to loopback, re-reads bad caption, preserves floorplan verification",async()=>{
 const dom=await setup(),d=dom.window.document;
 edit(dom,d.querySelector("#cyexp-unit"),"內部方案");
 await fileSelect(dom,"臥室.png");
 const initial=d.querySelector(".cyexp-item");
 edit(dom,initial.querySelector('[data-attr="description"]'),"床與桌子和電視機的房間","change");
 const calls=[];
 dom.window.fetch=async (url,opts)=>{
   calls.push({url:String(url),method:opts?.method,headers:opts?.headers});
   if(String(url).endsWith("/v1/models")){
     return {ok:true,json:async()=>({data:[{id:"qwen3-vl-8b"}]})};
   }
   if(String(url).endsWith("/v1/chat/completions")){
     const req=JSON.parse(opts.body);
     assert.equal(req.model,"qwen3-vl-8b");
     assert.ok(req.messages[1].content.some(p=>p.type==="image_url"&&p.image_url.url.startsWith("data:image/png;base64,")));
     return {ok:true,json:async()=>({choices:[{message:{
       content:JSON.stringify({space:"臥室",description:"臥室採用淺木色床頭背板與大片窗簾，梳妝桌旁配置圓形燈鏡，畫面為室內設計3D示意圖。"})
     }}]})};
   }
   throw Error("unexpected URL: "+url);
 };
 edit(dom,d.querySelector("#cyexp-local-token"),"temporary-only");
 assert.equal(calls.length,0,"No localhost call until explicit click");
 d.querySelector("#cyexp-connect").click();
 await new Promise(r=>setTimeout(r,30));
 assert.equal(d.querySelector("#cyexp-local-read").disabled,false,d.querySelector("#cyexp-local-status").textContent);
 d.querySelector("#cyexp-local-read").click();
 await new Promise(r=>setTimeout(r,90));
 const result=d.querySelector(".cyexp-item");
 assert.match(result.querySelector('[data-attr="description"]').value,/淺木色床頭背板/);
 assert.match(result.querySelector('[data-attr="alt"]').value,/丹佛花都/);
 assert.equal(result.querySelector('[data-attr="verified"]').checked,false);
 assert.ok(calls.every(x=>x.url.startsWith("http://127.0.0.1:1234/v1/")));
 assert.equal((script.match(/targetAddressSpace:"loopback"/g)||[]).length,2,"Both model listing and image inference must declare Chrome loopback address space");
 assert.ok(calls.every(x=>x.headers?.Authorization==="Bearer temporary-only"));
 assert.doesNotMatch(script,/localStorage\.setItem\([^)]*cyexp-local-token/);
 dom.window.close();
});
test("local vision rejects unsupported or hallucinated non-JSON output",()=>{
 assert.match(script,/parseLocalVision\(output\)/);
 assert.match(script,/throw Error\("模型沒有提供 JSON 圖片描述/);
 assert.match(script,/a\.verified=false;/);
 assert.match(script,/done\+\+;/);
});

test("HTTPS GitHub Pages connects to loopback with explicit browser address-space hint and diagnostic link", async()=>{
 const dom=await setup();
 const d=dom.window.document;
 assert.match(script,/targetAddressSpace:"loopback"/);
 assert.equal((script.match(/targetAddressSpace:"loopback"/g)||[]).length,2);
 const link=d.querySelector("#cyexp-local-check-url");
 assert.equal(link.href,"http://127.0.0.1:1234/v1/models");
 assert.equal(link.target,"_blank");
 assert.match(d.querySelector("#cyexp-local-ai").textContent,/Enable CORS/);
 assert.match(d.querySelector("#cyexp-local-ai").textContent,/Serve on Local Network/);
 dom.window.close();
});

test("import full CMS HTML in one paste and match uploads by filename even when image order is reversed",async()=>{
 const dom=await setup();const d=dom.window.document;
 await fileSelect(dom,"living.png");
 await fileSelect(dom,"新格局圖.png");
 const html=[
  '<p><img src="https://chen-yang.com.tw/upload/images/%E6%96%B0%E6%A0%BC%E5%B1%80%E5%9C%96.webp" alt="uploaded layout"></p>',
  '<p><img src="https://chen-yang.com.tw/upload/images/living.jpg" alt="uploaded render"></p>'
 ].join("\n");
 edit(dom,d.querySelector("#cyexp-cms-html"),html);
 d.querySelector("#cyexp-match-cms").click();
 const urls=[...d.querySelectorAll(".cyexp-item [data-attr=url]")].map(x=>x.value);
 assert.equal(urls[0],"https://chen-yang.com.tw/upload/images/living.jpg");
 assert.match(urls[1],/%E6%96%B0%E6%A0%BC%E5%B1%80%E5%9C%96.webp/);
 assert.match(d.querySelector("#cyexp-cms-match-status").textContent,/檔名配對 2、順序推定 0/);
 assert.equal(d.querySelector("#cyexp-copy").disabled,true,"Still requires valid floorplan, text and verification");
 dom.window.close();
});
test("unknown CMS renames use exact batch order only, never silently match extra existing images",async()=>{
 const dom=await setup();const d=dom.window.document;
 await fileSelect(dom,"living.png");await fileSelect(dom,"新格局圖.png");
 edit(dom,d.querySelector("#cyexp-cms-html"),
  '<div><img src="https://chen-yang.com.tw/upload/images/random-1.jpg"><img src="https://chen-yang.com.tw/upload/images/random-2.jpg"></div>');
 d.querySelector("#cyexp-match-cms").click();
 assert.match(d.querySelector("#cyexp-cms-match-status").textContent,/順序推定 2/);
 assert.match(d.querySelector(".cyexp-item .cyexp-muted").textContent,/1\. living\.png/);
 const rows=d.querySelectorAll(".cyexp-item [data-attr=url]");
 assert.match(rows[0].value,/random-1/);
 assert.match(rows[1].value,/random-2/);
 edit(dom,d.querySelector("#cyexp-cms-html"),
  '<div><img src="https://chen-yang.com.tw/upload/images/old.jpg"><img src="https://chen-yang.com.tw/upload/images/next.jpg"><img src="https://chen-yang.com.tw/upload/images/extra.jpg"></div>');
 rows.forEach(x=>edit(dom,x,""));
 d.querySelector("#cyexp-match-cms").click();
 assert.match(d.querySelector("#cyexp-cms-match-status").textContent,/沒有安全的檔名配對/);
 assert.ok([...d.querySelectorAll(".cyexp-item [data-attr=url]")].every(x=>x.value===""),"no guessing for unsafe pasted batch");
 dom.window.close();
});
test("CMS HTML importer refuses offsite image URLs and never runs pasted scripts",async()=>{
 const dom=await setup();const d=dom.window.document;
 await fileSelect(dom,"living.png");
 edit(dom,d.querySelector("#cyexp-cms-html"),
  '<script>window.exampleInjected=1</script><img src="https://evil.example/upload/living.jpg"><img src="javascript:alert(1)">');
 d.querySelector("#cyexp-match-cms").click();
 assert.equal(dom.window.exampleInjected,undefined);
 assert.match(d.querySelector("#cyexp-cms-match-status").textContent,/沒有找到晨陽官網可使用的圖片網址/);
 assert.equal(d.querySelector(".cyexp-item [data-attr=url]").value,"");
 dom.window.close();
});

test("one human batch approval replaces repeated checkboxes but cannot bypass floorplan or CMS image URL requirements",async()=>{
 const dom=await setup(),d=dom.window.document;
 await fileSelect(dom,"living.png");await fileSelect(dom,"新格局圖.png");
 d.querySelector("#cyexp-approve-reviewed").click();
 assert.match(d.querySelector("#cyexp-vision-status").textContent,/缺少描述或 ALT/);
 let rows=d.querySelectorAll(".cyexp-item");
 for(let i=0;i<rows.length;i++){
  let row=d.querySelectorAll(".cyexp-item")[i];
  edit(dom,row.querySelector('[data-attr="description"]'),
   i===0?"沙發和木製收納櫃、開放客餐廳":"平面圖標示室內格局與不同區域動線","change");
  row=d.querySelectorAll(".cyexp-item")[i];
  edit(dom,row.querySelector('[data-attr="alt"]'),
   i===0?"丹佛花都｜木質櫃體客廳3D建模示意圖｜晨陽設計":"丹佛花都｜住宅平面配置圖｜晨陽設計","change");
 }
 d.querySelector("#cyexp-approve-reviewed").click();
 rows=d.querySelectorAll(".cyexp-item");
 assert.ok([...rows].every(x=>x.querySelector('[data-attr="verified"]').checked));
 assert.equal(d.querySelector("#cyexp-copy").disabled,true,"No export unless new floorplan, CMS URLs, original article and other checks pass");
 assert.match(d.querySelector("#cyexp-status").textContent,/新圖片尚未全部取得有效/);
 dom.window.close();
});

test("clipboard import prefers rich text/html from CMS over copied visible text, without per-image URL entry",async()=>{
 const dom=await setup(),d=dom.window.document;
 await fileSelect(dom,"living.png");await fileSelect(dom,"新格局圖.png");
 Object.defineProperty(dom.window.navigator,"clipboard",{configurable:true,value:{
  read:async()=>[{types:["text/plain","text/html"],getType:async(type)=>({
   text:async()=>type==="text/html"?
    '<p><img src="https://chen-yang.com.tw/upload/images/living.webp"></p><p><img src="https://chen-yang.com.tw/upload/images/%E6%96%B0%E6%A0%BC%E5%B1%80%E5%9C%96.webp"></p>':
    "客廳照片和格局圖"
  })}],
  readText:async()=>{throw Error("Should prefer rich HTML over text");}
 }});
 d.querySelector("#cyexp-paste-cms").click();
 await new Promise(r=>setTimeout(r,25));
 const urls=[...d.querySelectorAll(".cyexp-item [data-attr=url]")].map(x=>x.value);
 assert.match(urls[0],/living.webp/);
 assert.match(urls[1],/E6%96%B0/);
 assert.match(d.querySelector("#cyexp-cms-match-status").textContent,/檔名配對 2/);
 dom.window.close();
});

test("REGRESSION: primary visible AI-read button is next to upload and reconnects Qwen3-VL on ONE click after page reload",async()=>{
 const dom=await setup(),d=dom.window.document;
 const main=d.querySelector("#cyexp-read"),upload=d.querySelector("#cyexp-files");
 assert.ok(main&&upload);
 assert.equal(main.closest("details"),null,"primary AI button must not be hidden in a collapsed settings panel");
 assert.match(main.textContent,/AI 讀圖.*LM Studio Qwen3-VL/);
 assert.ok(main.closest(".cyexp-actions").contains(upload));
 assert.equal(d.querySelector("#cyexp-local-ai").open,false);
 await fileSelect(dom,"bedroom.png");
 let modelCalls=0,inferenceCalls=0;
 dom.window.fetch=async (url,opts)=>{
  if(String(url).endsWith("/v1/models")){
   modelCalls++;
   return {ok:true,json:async()=>({data:[{id:"qwen/qwen3-vl-8b"}]})};
  }
  if(String(url).endsWith("/v1/chat/completions")){
   inferenceCalls++;
   const req=JSON.parse(opts.body);
   assert.equal(req.model,"qwen/qwen3-vl-8b");
   assert.ok(req.messages[1].content.some(x=>x.type==="image_url"));
   return {ok:true,json:async()=>({choices:[{message:{content:JSON.stringify({
    space:"臥室",description:"白色與木質調的臥室空間，床邊有梳妝桌及窗簾，圖面呈現室內設計的空間安排與光線。"
   })}}]})};
  }
  throw new Error("unrecognized request "+url);
 };
 main.click();
 await new Promise(r=>setTimeout(r,130));
 assert.equal(modelCalls,1,"single AI button click must reconnect LM Studio");
 assert.equal(inferenceCalls,1,"same AI click must launch image inference");
 const item=d.querySelector(".cyexp-item");
 assert.match(item.querySelector('[data-attr="description"]').value,/木質調的臥室/);
 assert.match(item.querySelector('[data-attr="alt"]').value,/丹佛花都/);
 assert.equal(item.querySelector('[data-attr="verified"]').checked,false);
 assert.match(d.querySelector("#cyexp-main-ai-status").textContent,/本機讀圖完成/);
 assert.ok(d.querySelector("#cyexp-cms-import-panel"),"CMS batch URL import must remain intact");
 assert.ok(d.querySelector("#cyexp-approve-reviewed"),"batch approval must remain intact");
 assert.ok(d.querySelector("#cyexp-fallback-read"),"fallback must remain explicitly available");
 dom.window.close();
});
test("REGRESSION: failed LM Studio connection never silently changes primary button to low-quality model",async()=>{
 const dom=await setup(),d=dom.window.document;
 await fileSelect(dom,"living.png");
 let calls=0;
 dom.window.fetch=async()=>{calls++;throw new TypeError("Failed to fetch");};
 d.querySelector("#cyexp-read").click();
 await new Promise(r=>setTimeout(r,40));
 assert.equal(calls,1,"only attempt real LM Studio connection");
 assert.match(d.querySelector("#cyexp-read").textContent,/LM Studio Qwen3-VL/);
 assert.doesNotMatch(d.querySelector("#cyexp-read").textContent,/備援/);
 assert.equal(d.querySelector("#cyexp-local-ai").open,true,"open diagnostics automatically after failure");
 assert.match(d.querySelector("#cyexp-main-ai-status").textContent,/連線被阻擋/);
 assert.equal(d.querySelector("#cyexp-copy").disabled,true);
 dom.window.close();
});
test("REGRESSION: no-image AI click explains what to do and does not connect or download models",async()=>{
 const dom=await setup(),d=dom.window.document;
 let calls=0;
 dom.window.fetch=async()=>{calls++;throw Error("should not be called");};
 d.querySelector("#cyexp-read").click();
 await new Promise(r=>setTimeout(r,25));
 assert.equal(calls,0);
 assert.match(d.querySelector("#cyexp-main-ai-status").textContent,/先選擇要讀圖的照片/);
 dom.window.close();
});

test("BEGINNER UX: one visible 3-step flow keeps all working features and hides only admin tools",async()=>{
 const dom=await setup(),d=dom.window.document;
 const app=d.querySelector("#case-expansion");
 const steps=[1,2,3].map(n=>d.querySelector("#cyexp-step"+n));
 assert.ok(steps.every(Boolean));
 assert.equal(d.querySelector("#cyexp-progress span[aria-current=step]").textContent.trim(),"① 選圖");
 assert.ok(steps[0].contains(d.querySelector("#cyexp-base")));
 assert.ok(steps[0].contains(d.querySelector("#cyexp-files")));
 assert.ok(steps[0].contains(d.querySelector("#cyexp-read")));
 assert.equal(d.querySelector("#cyexp-read").closest("details"),null,"AI must not hide inside any collapsed panel");
 assert.ok(steps[1].contains(d.querySelector("#cyexp-items")));
 assert.ok(steps[1].contains(d.querySelector("#cyexp-approve-reviewed")));
 assert.ok(steps[1].contains(d.querySelector("#cyexp-intro")));
 assert.ok(steps[2].contains(d.querySelector("#cyexp-cms-import-panel")));
 assert.ok(steps[2].contains(d.querySelector("#cyexp-copy")));
 assert.ok(steps[2].contains(d.querySelector("#cyexp-confirm-floorplan")));
 assert.ok(d.querySelector("#cyexp-extra").contains(d.querySelector("#cyexp-bulk-urls")));
 assert.ok(d.querySelector("#cyexp-extra").contains(d.querySelector("#cyexp-newbase")));
 assert.ok(d.querySelector("#cyexp-extra").contains(d.querySelector("#cyexp-export")));
 assert.equal(d.querySelector("#cyexp-extra").open,false);
 assert.ok(d.querySelector("#cyexp-unit").value,"new hires do not need to type a unit code");
 assert.match(d.querySelector("#cyexp-next").textContent,/選擇建案與圖片/);
 assert.equal(d.querySelector("#cyexp-copy").disabled,true);
 dom.window.close();
});
test("BEGINNER UX: progress advances from select images to image review, and does not mislabel missing floorplan as done",async()=>{
 const dom=await setup(),d=dom.window.document;
 await fileSelect(dom,"living.png");
 assert.match(d.querySelector("#cyexp-next").textContent,/AI 讀圖/);
 assert.equal(d.querySelector("#cyexp-progress span[aria-current=step]").textContent.trim(),"② AI 介紹與 ALT");
 assert.equal(d.querySelector("#cyexp-copy").disabled,true);
 assert.match(d.querySelector("#cyexp-status").textContent,/缺少新的平面配置圖/);
 dom.window.close();
});

test("FLOORPLAN: uploaded floorplan is described as 2D layout, never invented furniture, material or 3D rendering",async()=>{
 const dom=await setup(),d=dom.window.document;
 await fileSelect(dom,"1.平面配置_套版 (1).png");
 const item=d.querySelector(".cyexp-item");
 assert.equal(item.querySelector('[data-attr="role"]').value,"格局圖");
 const description=item.querySelector('[data-attr="description"]').value;
 const alt=item.querySelector('[data-attr="alt"]').value;
 assert.match(description,/住宅平面配置圖/);
 assert.match(description,/空間分區/);
 assert.doesNotMatch(description,/木作|沙發|茶几|電視牆|收納櫃|3D/);
 assert.match(alt,/丹佛花都/);
 assert.match(alt,/平面配置圖與空間動線/);
 assert.doesNotMatch(alt,/木作|沙發|茶几|電視牆|3D/);
 assert.equal(item.querySelector('[data-attr="verified"]').checked,false);
 dom.window.close();
});
test("FLOORPLAN: LM Studio only analyzes renders; uploaded floorplans use explicitly conservative 2D descriptions",async()=>{
 const dom=await setup(),d=dom.window.document;
 await fileSelect(dom,"1.平面配置_套版 (1).png");
 await fileSelect(dom,"living.png");
 const calls=[];
 dom.window.fetch=async (url,opts)=>{
  if(String(url).endsWith("/v1/models"))return {ok:true,json:async()=>({data:[{id:"qwen/qwen3-vl-8b"}]})};
  if(String(url).endsWith("/v1/chat/completions")){
   calls.push(JSON.parse(opts.body));
   return {ok:true,json:async()=>({choices:[{message:{content:JSON.stringify({
    space:"客廳",description:"室內客廳設計呈現淺色沙發與淺木色展示櫃，旁邊有開放式客餐廳連接廚房。"
   })}}]})};
  }
  throw Error("unexpected fetch "+url);
 };
 d.querySelector("#cyexp-read").click();
 await new Promise(r=>setTimeout(r,160));
 assert.equal(calls.length,1,"AI must not invent floorplan interior finishes");
 const rows=d.querySelectorAll(".cyexp-item");
 assert.match(rows[0].querySelector('[data-attr="description"]').value,/住宅平面配置圖/);
 assert.doesNotMatch(rows[0].querySelector('[data-attr="description"]').value,/沙發|木作|茶几|電視牆/);
 assert.match(rows[1].querySelector('[data-attr="description"]').value,/淺色沙發/);
 assert.equal(rows[0].querySelector('[data-attr="verified"]').checked,false);
 assert.match(rows[0].textContent,/不是精確圖面判讀/);
 dom.window.close();
});
test("FLOORPLAN: wrong room caption, ALT and previously checked approval cannot pass batch review or export",async()=>{
 const dom=await setup(),d=dom.window.document;
 await fileSelect(dom,"1.平面配置_套版 (1).png");
 let item=d.querySelector(".cyexp-item");
 edit(dom,item.querySelector('[data-attr="description"]'),"客廳區域標有沙發與茶几，牆面有木作線條及電視牆收納櫃","change");
 item=d.querySelector(".cyexp-item");
 edit(dom,item.querySelector('[data-attr="alt"]'),"丹佛花都 林口A7 平面配置圖｜木作與沙發茶几3D示意","change");
 item=d.querySelector(".cyexp-item");
 assert.equal(item.querySelector('[data-attr="verified"]').disabled,true,"cannot approve claim about 3D furnishing from a floorplan");
 assert.match(item.textContent,/格局圖/);
 d.querySelector("#cyexp-approve-reviewed").click();
 assert.equal(item.querySelector('[data-attr="verified"]').checked,false);
 assert.equal(d.querySelector("#cyexp-copy").disabled,true);
 assert.match(d.querySelector("#cyexp-vision-status").textContent,/格局圖仍有不實材質／家具敘述/);
 dom.window.close();
});
test("FLOORPLAN: changing photo classification to floorplan resets wrong AI room narrative and ALT, invalidates approval",async()=>{
 const dom=await setup(),d=dom.window.document;
 await fileSelect(dom,"living.png");
 let item=d.querySelector(".cyexp-item");
 edit(dom,item.querySelector('[data-attr="description"]'),"臥室有沙發茶几電視牆和木作飾板","change");
 item=d.querySelector(".cyexp-item");
 edit(dom,item.querySelector('[data-attr="alt"]'),"丹佛花都 臥室沙發茶几電視牆","change");
 item=d.querySelector(".cyexp-item");
 item.querySelector('[data-attr="role"]').value="格局圖";
 item.querySelector('[data-attr="role"]').dispatchEvent(new dom.window.Event("change",{bubbles:true}));
 item=d.querySelector(".cyexp-item");
 assert.equal(item.querySelector('[data-attr="role"]').value,"格局圖");
 assert.match(item.querySelector('[data-attr="description"]').value,/住宅平面配置圖/);
 assert.doesNotMatch(item.querySelector('[data-attr="alt"]').value,/沙發|茶几|電視牆/);
 assert.equal(item.querySelector('[data-attr="verified"]').checked,false);
 dom.window.close();
});
test("FLOORPLAN: editing an approved plan description instantly revokes approval, even before input blur",async()=>{
 const dom=await setup(),d=dom.window.document;
 await fileSelect(dom,"1.平面配置_套版 (1).png");
 let item=d.querySelector(".cyexp-item");
 item.querySelector('[data-attr="verified"]').checked=true;
 item.querySelector('[data-attr="verified"]').dispatchEvent(new dom.window.Event("change",{bubbles:true}));
 item=d.querySelector(".cyexp-item");
 assert.equal(item.querySelector('[data-attr="verified"]').checked,true);
 const field=item.querySelector('[data-attr="description"]');
 field.value="木作線條和沙發的格局圖";
 field.dispatchEvent(new dom.window.Event("input",{bubbles:true}));
 assert.equal(item.querySelector('[data-attr="verified"]').checked,false);
 assert.equal(d.querySelector("#cyexp-copy").disabled,true);
 dom.window.close();
});
