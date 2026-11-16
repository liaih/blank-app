const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const {JSDOM}=require('jsdom');
const html=fs.readFileSync('docs/monitor.html','utf8');
const source='<h2>新建案原文</h2><p>保留原文與戶型</p><img src="https://chen-yang.com.tw/upload/old.png" alt="原格局圖"><h2>延伸閱讀</h2><p>原連結</p>';
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
 const input=d.querySelector('#cyexp-files');Object.defineProperty(input,'files',{value:[file]});input.dispatchEvent(new dom.window.Event('change'));
 await new Promise(r=>setTimeout(r,80));
 const draft=d.querySelector('#cyexp-draft-html').value;
 assert.match(draft,/保留原文與戶型/);assert.match(draft,/new-3d.png/);assert.match(draft,/3D 建模示意圖/);
 assert.ok(draft.indexOf('chenyang-case-addition')<draft.indexOf('延伸閱讀'));
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
