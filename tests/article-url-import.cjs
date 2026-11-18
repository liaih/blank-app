const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const {JSDOM}=require('jsdom');
const html=fs.readFileSync('docs/monitor.html','utf8');
const source='<div class="chenyang-seo-draft-warning" data-publish-status="not-approved"><strong>SEO 草稿｜未通過正式上稿驗收，不可直接發佈</strong><p>AI 描述與格局圖需人工核對。</p></div><p>舊描述（3D 建模示意圖，非施工完成證明）</p><h2>新建案原文</h2><p style="margin:0 0 18px;line-height:1.9;"><span style="font-size:18px;color:#333333;">保留原文與戶型</span></p><p><a href="https://chen-yang.com.tw/news.php"><span style="color:#ADD8E6">原資料連結</span></a></p><img src="https://chen-yang.com.tw/upload/old.png" alt="原格局圖"><h2>延伸閱讀</h2><p>原連結</p>';
async function setup(storage={},daily={schema:1,articles:[]}){
 const dom=new JSDOM(html,{runScripts:'outside-only',url:'https://liaih.github.io/blank-app/monitor.html#actions'});
 for(const [key,value] of Object.entries(storage))dom.window.localStorage.setItem(key,value);
 dom.window.fetch=async url=>{
  if(String(url).endsWith('/seo-daily-articles.json'))return {ok:true,json:async()=>daily};
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
test('daily drafts appear in the editor with copyable HTML and preserve completion history',async()=>{
 const published=JSON.parse(fs.readFileSync('docs/seo-daily-articles.json','utf8'));
 const feed={...published,added_count:3,articles:published.articles.slice(0,3)};
 const first=feed.articles[0];
 const dom=await setup({},feed);
 try{
  const d=dom.window.document;
  assert.match(d.getElementById('action-daily-update').textContent,/新增 3 \/ 3 篇/);
  assert.match(d.getElementById('action-state-summary').textContent,/待修改 6 篇｜已完成 5 篇/);
  choose(d,'action-article',first.plan.id);
  assert.equal(d.getElementById('cyexp-base').value,first.plan.id);
  const text=d.querySelector('#seo-article-actions textarea').value;
  assert.ok(text.includes(first.draft.sections[1][0]));
  assert.match(text,/格局圖與空間配置/);
  action(d,'標記完成並移至歷史紀錄');
  assert.equal(d.getElementById('action-view').value,'archive');
  assert.match(d.getElementById('action-state-summary').textContent,/待修改 5 篇｜已完成 6 篇/);
 }finally{dom.window.close();}
});
const taskKey='chenyang-geo-tasks-v1';
const completionKey='chenyang-seo-completion-v1';
const draftKey='chenyang-seo-case-drafts-v2';
function choose(d,id,value){
 const field=d.querySelector('#'+id);
 field.value=value;
 field.dispatchEvent(new d.defaultView.Event('change'));
}
function action(d,label){
 const button=[...d.querySelectorAll('#seo-article-actions button')].find(b=>b.textContent===label);
 assert.ok(button,label);
 button.click();
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
 action(d,'標記完成並移至歷史紀錄');
 assert.equal(d.querySelector('#action-view').value,'archive');
 assert.equal(d.querySelector('#seo-article-actions textarea').value,copied);
 const reloaded=await setup({
  [taskKey]:dom.window.localStorage.getItem(taskKey),
  [completionKey]:dom.window.localStorage.getItem(completionKey)
 });
 try{
  const rd=reloaded.window.document;
  rd.querySelector('#action-history-toggle').click();
  assert.equal(rd.querySelector('#action-article').value,'url-news-99999');
  assert.equal(rd.querySelector('#seo-article-actions textarea').value,copied);
  assert.match(rd.querySelector('#seo-article-actions').textContent,/完成紀錄/);
  const completedAt=JSON.parse(reloaded.window.localStorage.getItem(completionKey))['url-news-99999'].completedAt;
  rd.querySelector('#cyexp-source-url').value='https://www.chen-yang.com.tw/news-content.php?id=99999';
  rd.querySelector('#cyexp-fetch-article').click();
  await new Promise(r=>setTimeout(r,60));
  assert.match(rd.querySelector('#cyexp-url-status').textContent,/已讀取最新/);
  assert.equal(rd.querySelector('#action-view').value,'archive');
  assert.equal(rd.querySelector('#seo-article-actions textarea').value,copied);
  assert.equal(JSON.parse(reloaded.window.localStorage.getItem(completionKey))['url-news-99999'].completedAt,completedAt);
  action(rd,'恢復待修改');
  assert.equal(rd.querySelector('#action-view').value,'pending');
  assert.equal(JSON.parse(reloaded.window.localStorage.getItem(completionKey))['url-news-99999'].status,'待修改');
 }finally{reloaded.window.close();}

 }finally{dom.window.close();}
});
test('earlier completion states and saved article drafts are recovered without inventing a completion',async()=>{
 const date='2026-11-16T06:00:00.000Z';
 const state={'seo-danfo-234':{status:'已驗證',completedAt:date},'url-news-777':{status:'已完成',completedAt:date}};
 const autosave={schema:2,cases:{'url-news-777':{newbase:source,intro:'先前保存的修改'},'url-news-888':{newbase:source,intro:'只有草稿'}}};
 const dom=await setup({[taskKey]:JSON.stringify(state),[draftKey]:JSON.stringify(autosave)});
 try{
  const d=dom.window.document;
  const chooser=d.querySelector('#action-article');
  assert.match(d.querySelector('#action-history-toggle').textContent,/（6）/);
  assert.ok([...chooser.options].some(option=>option.value==='url-news-888'));
  d.querySelector('#action-history-toggle').click();
  assert.deepEqual([...chooser.options].slice(0,2).map(option=>option.value),['seo-danfo-234','url-news-777']);
  choose(d,'action-article','url-news-777');
  assert.equal(d.querySelector('#cyexp-newbase').value,source);
  assert.equal(d.querySelector('#cyexp-intro').value,'先前保存的修改');
  assert.match(d.querySelector('#seo-article-actions').textContent,/未保存改稿 HTML/);
  assert.equal(d.querySelector('#seo-article-actions a').href,'https://www.chen-yang.com.tw/news-content.php?id=777');
  d.querySelector('#action-history-toggle').click();
  choose(d,'action-article','url-news-888');
  assert.equal(d.querySelector('#cyexp-intro').value,'只有草稿');
  assert.equal(dom.window.localStorage.getItem(taskKey),JSON.stringify(state));
  assert.equal(JSON.parse(dom.window.localStorage.getItem(completionKey))['url-news-777'].completedAt,date);
 }finally{dom.window.close();}
});
test('saving a previously loaded AI SEO task preserves newer article completion history',async()=>{
 const dom=await setup();
 try{
  const d=dom.window.document;
  const owner=[...d.querySelectorAll('#geo-task-rows tr')].find(row=>row.textContent.includes('核對 Perplexity 擷取驗證失敗原因'))?.querySelector('input');
  assert.ok(owner);
  choose(d,'action-article','seo-fumei-503');
  action(d,'標記完成並移至歷史紀錄');
  owner.value='編輯';
  owner.dispatchEvent(new dom.window.Event('change'));
  const records=JSON.parse(dom.window.localStorage.getItem(taskKey));
  assert.equal(records['capture-perplexity'].owner,'編輯');
  const completed=JSON.parse(dom.window.localStorage.getItem(completionKey))['seo-fumei-503'];
  assert.equal(completed.status,'已完成');
  assert.match(completed.completedHtml,/福美富琚/);
 }finally{dom.window.close();}
});
test('verified live publications recover five archive entries even with empty local storage',async()=>{
 const dom=await setup();
 try{
  const d=dom.window.document;
  const browserStorage=dom.window.localStorage;
  const chooser=d.querySelector('#action-article');
  d.querySelector('#action-history-toggle').click();
  assert.deepEqual(new Set([...chooser.options].map(option=>option.value)),new Set([
   'seo-danfo-234','seo-yunjiang-331','seo-hongguang-253','seo-housheng-451','ai-kaohsiung-536'
  ]));
  choose(d,'action-article','seo-danfo-234');
  assert.match(d.querySelector('#seo-article-actions').textContent,/從官網找回.*原本的完成時間未留存/);
  assert.equal(d.querySelector('#seo-article-actions a').href,'https://www.chen-yang.com.tw/news-content.php?id=234');
  assert.equal(browserStorage.getItem(completionKey),null);
  action(d,'恢復待修改');
  assert.ok([...chooser.options].some(option=>option.value==='seo-danfo-234'));
  browserStorage.setItem(taskKey,JSON.stringify({'seo-danfo-234':{status:'已完成'}}));
  d.querySelector('#action-history-toggle').click();
  assert.ok(![...chooser.options].some(option=>option.value==='seo-danfo-234'));
 }finally{dom.window.close();}
});
test('all eight articles share the corrected preview and HTML copy formatting',async()=>{
 const dom=await setup();try{
  const d=dom.window.document;
  const chooser=d.querySelector('#action-article');
  const modes=new Map([...chooser.options].map(option=>[option.value,'pending']));
  d.querySelector('#action-history-toggle').click();
  for(const option of chooser.options)modes.set(option.value,'archive');
  const ids=[...modes.keys()];
  assert.equal(ids.length,8);
  let copied='';
  Object.defineProperty(dom.window.navigator,'clipboard',{value:{writeText:async html=>{copied=html;}}});
  const panel=d.querySelector('#seo-article-actions');
  const media=JSON.parse(fs.readFileSync('docs/seo-media-rewrites.json','utf8')).articles;
  const sourceAssets=(article,selector,attribute)=>[...article.querySelectorAll(selector)].map(node=>node.getAttribute(attribute));
  for(const id of ids){
   choose(d,'action-view',modes.get(id));
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
