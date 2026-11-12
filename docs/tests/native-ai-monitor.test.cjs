"use strict";
const assert=require("node:assert/strict");
const fs=require("node:fs");
const path=require("node:path");
const html=fs.readFileSync(path.join(__dirname,"..","monitor.html"),"utf8");
for(const id of [
 "native-ai-status","native-ai-hint","native-chatgpt","native-gemini",
 "native-perplexity","native-total","native-platform-rows"
]){
 assert.ok(html.includes('id="'+id+'"'),"Missing native AI monitoring UI: "+id);
}
assert.ok(html.includes('fetch("./native-ai-summary.json"'),"Must read separated actual platform data");
assert.ok(html.includes('fetch("./ai-search-summary.json"'),"Keep legacy RAG separate");
assert.ok(html.includes('data.not_own_tavily_rag!==true'),"Native data must prove scope distinction");
assert.ok(html.includes("ChatGPT・Gemini・Perplexity｜原平台回答監測"));
assert.ok(html.includes("進階功能｜手動補充 AI 回答證據（選填，不需每天操作）"));
assert.ok(!html.includes('ChatGPT 搜尋回答</span><span class="label">尚無可核對樣本'),"Do not show obsolete hard-coded ChatGPT disconnected status");
for(const id of ["legacy-chatgpt-status","legacy-gemini-status","legacy-perplexity-status","legacy-sourced-count"]){
  assert.ok(html.includes('id="'+id+'"'),"Live progress ID missing: "+id);
  assert.ok(html.split('"'+id+'"').length>1,"Live status must be referenced in script: "+id);
}
assert.ok(html.includes("legacyStatus.textContent=n?"),"Live status should derive from actual samples");
assert.ok(html.includes("第三方平台回答 ≠ 經證實啟用網路搜尋"),"Must explain actual reply vs confirmed web search");
assert.ok(html.includes("Gemini 官方 API Google Search Grounding"),"Must distinguish Gemini native API grounding from platform answer captures");
assert.equal((html.match(/<section\b/g)||[]).length,(html.match(/<\/section>/g)||[]).length);
assert.equal((html.match(/<details\b/g)||[]).length,(html.match(/<\/details>/g)||[]).length);
assert.ok(html.indexOf("ChatGPT・Gemini・Perplexity｜原平台回答監測")<
          html.indexOf("每日自動 AI 聯網競品觀測"),"Real platforms should appear above custom RAG");
console.log("Native ChatGPT/Gemini/Perplexity dashboard UI checks passed");
