"use strict";
const assert=require("node:assert/strict");
const path=require("node:path");
const fs=require("node:fs");
require(path.join(__dirname,"..","ai-seo-evidence.js"));
const api=global.AISeoEvidence;
assert.ok(api);
const answer=[
 "推薦的設計公司：",
 "1. 晨陽室內設計：具有新成屋案例。",
 "2. 樂居空間設計：可比較服務範圍。",
 "來源：https://chen-yang.com.tw/news-content.php?id=331",
 "其他：https://example.com/guide"
].join("\n");
const record={
 id:"fixture-01",platform:"ChatGPT",
 prompt:"桃園新成屋裝潢，推薦哪些有實際案例的室內設計公司？",
 answer,answered_at:"2026-11-12T13:00",search:"yes",personalization:"clean",
 evidence_url:"https://chatgpt.com/share/sample-evidence",
 recommended:["晨陽室內設計","樂居空間設計"],citations:["https://chen-yang.com.tw/news-content.php?id=331"]
};
const sample=api.validate(record);
let result=api.evaluate(sample);
assert.equal(result.eligible,true);
assert.equal(result.mentioned,true);
assert.equal(result.recommended,true);
assert.equal(result.cited,true);
assert.deepEqual(result.competitors,["樂居空間設計"]);
assert.equal(result.citations.length,2);
assert.ok(api.extractCandidates(answer).includes("晨陽室內設計"));
assert.ok(api.urls("https://chen-yang.com.tw/foo, https://abc.com/news").includes("https://abc.com/news"));
assert.throws(()=>api.validate({...record,recommended:["晨陽室內設計","不存在設計公司"]}),/不在回答原文中/);
assert.throws(()=>api.validate({...record,evidence_url:"javascript:alert(1)"}),/只能使用/);
assert.throws(()=>api.validate({...record,answer:"太短"}),/至少 30 字/);
const personal=api.validate({...record,id:"fixture-02",personalization:"personalized"});
assert.equal(api.evaluate(personal).eligible,false);
const noSearch=api.validate({...record,id:"fixture-03",search:"no"});
assert.equal(api.evaluate(noSearch).eligible,false);
const noProof=api.validate({...record,id:"fixture-04",evidence_url:""});
assert.equal(api.evaluate(noProof).eligible,false);
const blankOthers=api.validate({
 ...record,id:"fixture-05",platform:"Gemini",
 answer:"對於桃園新成屋室內裝潢，我建議先比較工程費用、預算透明度與案例。可以先了解裝修流程與實際保固，確認每間公司的合約條款。",
 recommended:[],citations:[],evidence_url:"https://gemini.google.com/share/abc"
});
assert.equal(api.evaluate(blankOthers).recommended,false);
assert.equal(api.evaluate(blankOthers).mentioned,false);
const stats=api.summarize([sample,personal,noSearch,noProof,blankOthers]);
assert.equal(stats.total,5);
assert.equal(stats.controlled,2);
assert.equal(stats.mentioned,1);
assert.equal(stats.recommended,1);
assert.equal(stats.cited,1);
assert.equal(stats.competitors[0][0],"樂居空間設計");
assert.equal(stats.platforms["ChatGPT"].samples,1);
assert.equal(stats.platforms["Gemini"].samples,1);
assert.deepEqual(api.summarize([]).competitors,[]);
assert.equal(api.summarize([]).controlled,0);
assert.ok(!api.evaluate(sample).competitors.includes("晨陽室內設計"));
const html=fs.readFileSync(path.join(__dirname,"..","monitor.html"),"utf8");
for(const id of ["ai-input-platform","ai-input-time","ai-input-model","ai-input-search","ai-input-clean","ai-input-prompt","ai-input-answer","ai-input-brands","ai-input-citations","ai-input-proof","ai-evidence-history","ai-platform-body","ai-competitor-body"]){
 assert.ok(html.includes('id="'+id+'"'),"Missing AI SEO input: "+id);
}
assert.ok(html.includes('ai-seo-evidence.js'));
assert.ok(html.includes('AI SEO｜品牌推薦、競品及引用監測'));
console.log("AI SEO evidence: input validation, brand matching, source provenance, competitor metrics and UI checks passed");
