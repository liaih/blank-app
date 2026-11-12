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
assert.equal((html.match(/<section\b/g)||[]).length,(html.match(/<\/section>/g)||[]).length);
assert.equal((html.match(/<details\b/g)||[]).length,(html.match(/<\/details>/g)||[]).length);
assert.ok(html.indexOf("ChatGPT・Gemini・Perplexity｜原平台回答監測")<
          html.indexOf("每日自動 AI 聯網競品觀測"),"Real platforms should appear above custom RAG");
console.log("Native ChatGPT/Gemini/Perplexity dashboard UI checks passed");
