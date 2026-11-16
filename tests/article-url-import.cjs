const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const {JSDOM}=require('jsdom');
const html=fs.readFileSync('docs/monitor.html','utf8');
const source='<div class="chenyang-seo-draft-warning" data-publish-status="not-approved"><strong>SEO 草稿｜未通過正式上稿驗收，不可直接發佈</strong><p>AI 描述與格局圖需人工核對。</p></div><p>舊描述（3D 建模示意圖，非施工完成證明）</p><h2>新建案原文</h2><p style="margin:0 0 18px;line-height:1.9;"><span style="font-size:18px;color:#333333;">保留原文與戶型</span></p><p><a href="https://chen-yang.com.tw/news.php"><span style="color:#ADD8E6">原資料連結</span></a></p><img src="https://chen-yang.com.tw/upload/old.png" alt="原格局圖"><h2>延伸閱讀</h2><p>原連結</p>';
async function setup(){
 const dom=new JSDOM(html,{runScripts:'outside-only',url:'https://liaih.github.io/blank-app/monitor.html#actions'});
 dom.window.fetch=async url=>{
  if(String(url).startsWith('http://127.0.0.1:8765/'))return {ok:true,json:async()=>({id:'url-news-99999',url:'https://www.chen-yang.com.tw/news-content.php?id=99999',title:'測試建案',html:source,metaTitle:'測試建案',metaDescription:'原摘要',checkedAt:new Date().toISOString(),imageCount:1,checks:[{status:'待改善',item:'ALT',detail:'需讀圖'}]})};
  const path='docs/'+String(url).replace(/^\.\//,'').split('?')[0];
  return {ok:fs.existsSync(path),json:async()=>JSON.parse(fs.readFileSync(path,'utf8'))};
 };
 dom.window.matchMedia=()=>({matches:false,addEventListener(){}});
 for(const script of dom.window.document.querySelectorAll('script')){
  if(script.src){const path='docs/'+new URL(script.src).pathname.split('/').pop();if(fs.existsSync(path))dom.window.eval(fs.readFileSync(path,'utf8'));}
  else if(!script.type||script.type==='text/javascript')dom.window.eval(script.textContent);
 }
 await new Promise(r=>setTimeout(r,100));return dom;
}
test('new URL loads audit into existing editor, preserves original and isolates case switches',async()=>{
 const dom=await setup();try{
 const d=dom.window.document;
 d.querySelector('#cyexp-source-url').value='https://www.chen-yang.com.tw/news-content.php?id=99999';
 d.querySelector('#cyexp-fetch-article').click();await new Promise(r=>setTimeout(r,60));
 assert.match(d.querySelector('#cyexp-url-status').textContent,/已讀取最新/);
 assert.equal(d.querySelector('#action-article').value,'url-news-99999');
 assert.equal(d.querySelector('#cyexp-base').value,'url-news-99999');
 assert.equal(d.querySelector('#cyexp-newbase').value,source);
 assert.equal(d.querySelector('#cyexp-confirm-base').checked,false);
 assert.equal(d.querySelector('#cyexp-copy').disabled,true);


 const chooser=d.querySelector('#action-article');const other=[...chooser.options].find(o=>o.value!=='url-news-99999').value;
 chooser.value=other;chooser.dispatchEvent(new dom.window.Event('change'));
 assert.notEqual(d.querySelector('#cyexp-newbase').value,source);
 chooser.value='url-news-99999';chooser.dispatchEvent(new dom.window.Event('change'));
 assert.equal(d.querySelector('#cyexp-newbase').value,source);
 assert.ok(d.querySelector('#cyexp-read'));assert.ok(d.querySelector('#cyexp-files'));
 // The existing draft generator must include both original and new sections.
 const bytes=new TextEncoder().encode('fake png');
 const file=new dom.window.File([bytes],'new-3d.png',{type:'image/png'});
 file.arrayBuffer=async()=>bytes.buffer;
 Object.defineProperty(dom.window.crypto,'subtle',{value:require('node:crypto').webcrypto.subtle});
 dom.window.URL.createObjectURL=()=> 'blob:preview';dom.window.URL.revokeObjectURL=()=>{};
 const input=d.querySelector('#cyexp-files');Object.defineProperty(input,'files',{value:[file],configurable:true});input.dispatchEvent(new dom.window.Event('change'));
 await new Promise(r=>setTimeout(r,80));
 const draft=d.querySelector('#cyexp-draft-html').value;
 assert.match(draft,/保留原文與戶型/);assert.match(draft,/new-3d.png/);assert.doesNotMatch(draft,/3D\s*建模示意圖/);
 assert.ok(draft.indexOf('chenyang-case-addition')<draft.indexOf('延伸閱讀'));
 const rendered=new JSDOM(draft).window.document;
 assert.equal(rendered.querySelector('.chenyang-seo-draft-warning'),null);
 assert.doesNotMatch(draft,/未通過正式上稿驗收，不可直接發佈|非施工完成證明/);
 const originalParagraph=[...rendered.querySelectorAll('p')].find(p=>p.textContent==='保留原文與戶型');
 assert.equal(originalParagraph.style.lineHeight,'1.9');
 assert.equal(originalParagraph.querySelector('span').style.fontSize,'18px');
 assert.equal(originalParagraph.querySelector('span').style.color,'rgb(51, 51, 51)');
 assert.equal(rendered.querySelector('.chenyang-case-addition p span').style.fontSize,'18px');
 assert.equal(rendered.querySelector('.chenyang-case-addition p span').style.color,'');
 assert.equal(rendered.querySelector('h3').style.color,'');
 assert.equal(rendered.querySelector('figcaption').style.color,'rgb(102, 102, 102)');
 assert.equal(rendered.querySelector('a span').style.color,'');
 assert.equal(rendered.querySelector('a').style.color,'inherit');
 assert.equal(rendered.querySelector('a').getAttribute('href'),'https://chen-yang.com.tw/news.php');
 for(const heading of rendered.querySelectorAll('h2')){
  assert.match(heading.getAttribute('style'),/color:.*!important/);
  assert.equal(heading.style.color,'rgb(197, 164, 126)');
 }
 assert.equal(rendered.querySelector('img').getAttribute('src'),'https://chen-yang.com.tw/upload/old.png');
 let copied='';Object.defineProperty(dom.window.navigator,'clipboard',{value:{writeText:async html=>{copied=html;}}});
 d.querySelector('#cyexp-copy-draft').click();await new Promise(r=>setTimeout(r,20));
 assert.equal(copied,draft);
 const compare=d.querySelector('.cyexp-item > .cyexp-compare');
 assert.deepEqual([...compare.querySelectorAll('strong')].map(label=>label.textContent),['本機原圖','官網圖片']);
 assert.equal(compare.querySelector('.cyexp-photo img').getAttribute('src'),'blob:preview');
 assert.equal(compare.querySelector('.cyexp-thumb + .cyexp-thumb .cyexp-photo').textContent,'尚未配對');
 const url=d.querySelector('.cyexp-item-fields [data-attr="url"]');
 url.value='https://chen-yang.com.tw/upload/new-3d.png';
 url.dispatchEvent(new dom.window.Event('change',{bubbles:true}));
 const pair=d.querySelectorAll('.cyexp-compare .cyexp-photo img');
 assert.deepEqual([...pair].map(img=>img.getAttribute('src')),['blob:preview',url.value]);
 assert.ok(d.querySelector('.cyexp-item-fields > .cyexp-inline-matcher input[type="checkbox"]'));
 const preview=d.querySelector('#cyexp-draft-preview .cyexp-article-frame');
 assert.equal(preview.closest('details').open,false);
 const previewDoc=new JSDOM(preview.srcdoc).window.document;
 assert.equal(previewDoc.querySelector('.chenyang-case-addition p span').style.color,'');
 assert.equal(previewDoc.querySelector('h2').style.color,'rgb(197, 164, 126)');
 assert.match(d.querySelector('#cyexp-draft-state').textContent,/草稿不是正式上稿核准/);
 assert.equal(d.querySelector('#cyexp-copy').disabled,true);

 const floorBytes=new TextEncoder().encode('floor plan');
 const floor=new dom.window.File([floorBytes],'新格局圖.png',{type:'image/png'});
 floor.arrayBuffer=async()=>floorBytes.buffer;
 Object.defineProperty(input,'files',{value:[floor]});
 input.dispatchEvent(new dom.window.Event('change'));
 await new Promise(r=>setTimeout(r,80));
 const change=new dom.window.Event('change',{bubbles:true});
 const description=d.querySelector('.cyexp-item [data-attr="description"]');
 description.value='客廳保留走道空間';
 description.dispatchEvent(change);
 const planUrl=d.querySelectorAll('.cyexp-item')[1].querySelector('[data-attr="url"]');
 planUrl.value='https://chen-yang.com.tw/upload/new-plan.png';
 planUrl.dispatchEvent(change);
 for(const checkbox of d.querySelectorAll('.cyexp-inline-pair-actions input,.cyexp-item [data-attr="verified"],#cyexp-confirm-base,#cyexp-confirm-urls,#cyexp-confirm-floorplan')){
  checkbox.checked=true;
  checkbox.dispatchEvent(change);
 }
 const intro=d.querySelector('#cyexp-intro');
 intro.value='新增案件整體介紹';
 intro.dispatchEvent(change);
 assert.equal(d.querySelector('#cyexp-copy').disabled,false,d.querySelector('#cyexp-status').textContent);
 d.querySelector('#cyexp-copy').click();
 await new Promise(r=>setTimeout(r,20));
 assert.equal(copied,d.querySelector('#cyexp-html').value);
 for(const html of [copied,d.querySelector('#cyexp-preview iframe').srcdoc]){
  const formal=new JSDOM(html).window.document;
  assert.equal(formal.querySelector('.chenyang-case-addition h2 span').style.color,'rgb(197, 164, 126)');
  assert.equal(formal.querySelector('.chenyang-case-addition p span').style.color,'');
  assert.equal(formal.querySelector('.chenyang-case-addition p span').style.fontSize,'18px');
  assert.match(formal.querySelector('img[src$="new-plan.png"]').alt,/住宅平面配置圖與空間動線/);
 }

 }finally{dom.window.close();}
});
test('all eight articles share the corrected preview and HTML copy formatting',async()=>{
 const dom=await setup();try{
  const d=dom.window.document;
  const chooser=d.querySelector('#action-article');
  const ids=[...chooser.options].map(option=>option.value);
  assert.equal(ids.length,8);
  let copied='';
  Object.defineProperty(dom.window.navigator,'clipboard',{value:{writeText:async html=>{copied=html;}}});
  const panel=d.querySelector('#seo-article-actions');
  const media=JSON.parse(fs.readFileSync('docs/seo-media-rewrites.json','utf8')).articles;
  const sourceAssets=(article,selector,attribute)=>[...article.querySelectorAll(selector)].map(node=>node.getAttribute(attribute));
  for(const id of ids){
   chooser.value=id;chooser.dispatchEvent(new dom.window.Event('change'));
   copied='';
   [...panel.querySelectorAll('button')].find(b=>b.textContent==='複製這篇完整 HTML').click();
   assert.equal(copied,panel.querySelector('textarea').value,id);
   const original=new JSDOM(media.find(entry=>entry.id===id).html_with_media).window.document;
   for(const html of [copied,panel.querySelector('iframe').srcdoc]){
    const article=new JSDOM(html).window.document;
    assert.equal(article.querySelector('h2 span').style.color,'rgb(197, 164, 126)',id);
    assert.doesNotMatch(html,/#add8e6|rgb\(173, 216, 230\)|3D\s*建模示意圖/i,id);
    assert.deepEqual(sourceAssets(article,'img','src'),sourceAssets(original,'img','src'),id);
    assert.deepEqual(sourceAssets(article,'a','href'),sourceAssets(original,'a','href'),id);
    assert.deepEqual(sourceAssets(article,'iframe,video','src'),sourceAssets(original,'iframe,video','src'),id);
    const expectedBody={
     'seo-danfo-234':['丹佛花都位於林口'],
     'ai-kaohsiung-536':['位於高雄市仁武區北屋北街','準備裝修新家','任職於台積電的客戶'],
     'seo-fumei-503':['準備裝修新家','任職於台積電的客戶']
    };
    for(const lead of expectedBody[id]||[]){
     const bodyText=[...article.querySelectorAll('p span')].find(node=>node.textContent.startsWith(lead));
     assert.ok(bodyText,id+' '+lead);
     assert.equal(bodyText.style.fontSize,'18px');
     assert.equal(bodyText.style.color,'');
     assert.equal(bodyText.closest('h2'),null);
    }
    if(id==='ai-kaohsiung-536'||id==='seo-fumei-503'){
     const retainedHeading=[...article.querySelectorAll('h2')].find(node=>node.textContent.trim()==='放樣驗收為何是保障權益的第一步？');
     assert.equal(retainedHeading.style.color,'rgb(197, 164, 126)',id);
     assert.equal(retainedHeading.nextElementSibling.tagName,'P',id);
    }
   }
  }
 }finally{dom.window.close();}
});
test('invalid URL and reader failure leave existing source untouched',async()=>{
 const dom=await setup();try{
 const d=dom.window.document;const original=d.querySelector('#cyexp-base').value;
 d.querySelector('#cyexp-source-url').value='https://evil.com/news-content.php?id=1';d.querySelector('#cyexp-fetch-article').click();
 assert.match(d.querySelector('#cyexp-url-status').textContent,/請貼上晨陽/);
 dom.window.fetch=async()=>{throw Error('offline')};
 d.querySelector('#cyexp-source-url').value='https://chen-yang.com.tw/news-content.php?id=99';d.querySelector('#cyexp-fetch-article').click();
 await new Promise(r=>setTimeout(r,30));
 assert.match(d.querySelector('#cyexp-url-status').textContent,/未完成最新/);
 assert.equal(d.querySelector('#cyexp-base').value,original);
 }finally{dom.window.close();}
});
