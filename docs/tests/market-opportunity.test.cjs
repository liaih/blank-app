"use strict";
const assert=require("node:assert/strict");
const path=require("node:path");
const fs=require("node:fs");

global.window=global;
require(path.join(__dirname,"..","market-opportunity.js"));
const m=global.MarketOpportunity;
assert.ok(m, "MarketOpportunity should export testable pure helpers");

assert.equal(m.classify("室內設計"),"廣泛探索");
assert.equal(m.classify("桃園室內設計推薦"),"比較／決策");
assert.equal(m.classify("老屋翻新"),"具體裝修需求");
assert.equal(m.region("桃園室內設計推薦"),"桃園");
assert.equal(m.region("台南裝潢"),"台南");
assert.equal(m.region("室內設計"),"全台泛詞");

const good=m.parseAdsCsv('\uFEFFKeyword,Avg. monthly searches\r\n"室內設計","1,200"\r\n桃園室內設計,100 – 1K\r\n');
assert.equal(good.accepted,2);
assert.equal(good.data.get("室內設計").value,1200);
assert.equal(good.data.get("桃園室內設計").kind,"range");
assert.equal(good.data.get("桃園室內設計").low,100);
assert.equal(good.data.get("桃園室內設計").high,1000);

const tw=m.parseAdsCsv("關鍵字,平均每月搜尋量\n室內設計,250\n");
assert.equal(tw.data.get("室內設計").value,250);
assert.throws(()=>m.parseAdsCsv("keyword,avg_monthly_searches\n室內設計,40\n室內設計,30\n"),/重複/);
assert.throws(()=>m.parseAdsCsv("keyword,avg_monthly_searches\n室內設計,無法驗證\n"),/無法解析/);
assert.throws(()=>m.parseAdsCsv("keyword,clicks\n室內設計,50\n"),/找不到/);

const ranked={keyword:"室內設計",current_30d:{impressions:49,position:25.37,clicks:1}};
const quiet={keyword:"桃園室內設計公司",current_30d:{impressions:null,position:null,clicks:null}};
assert.equal(m.decide(ranked,null).label,"優先檢查排名");
assert.equal(m.decide(quiet,null).label,"待補市場與排名資料");
assert.equal(m.decide(quiet,{kind:"exact",value:500}).label,"有市場資料，待驗證");
assert.equal(m.decide({keyword:"裝潢公司",current_30d:{impressions:1,position:1,clicks:0}},null).label,"曝光樣本極少");
assert.equal(m.decide({keyword:"室內設計推薦",current_30d:{impressions:50,position:9,clicks:0}},null).label,"優先檢查點擊率");

// Guard against inflating first-party GSC impressions into market volume.
const source=fs.readFileSync(path.join(__dirname,"..","market-opportunity.js"),"utf8");
assert.ok(!/market=\s*\w+\.current_30d\.impressions/.test(source));
console.log("SEO market opportunity: 18 validation assertions passed");
