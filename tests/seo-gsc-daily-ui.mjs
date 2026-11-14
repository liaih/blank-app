import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const html=readFileSync(new URL("../docs/monitor.html",import.meta.url),"utf8");
const js=readFileSync(new URL("../docs/seo-daily-ui.js",import.meta.url),"utf8");

test("SEO daily check and history are separated from AI SEO with one mounted UI",()=>{
 const seo=html.indexOf('id="view-seo"'),history=html.indexOf('id="seo-history"');
 const opps=html.indexOf('id="view-opps"');
 assert.ok(seo>0&&history>seo&&opps>history);
 for(const id of ["seo-daily-date","seo-daily-source","seo-daily-status","seo-daily-keywords",
 "seo-history-rows","seo-history-filter","seo-history-export","seo-period-source"]){
  assert.equal(html.split('id="'+id+'"').length-1,1,id);
 }
 assert.match(html,/seo-daily-ui\.js\?v=gsc-history-20261115/);
});

test("30/90 legacy KPIs refresh from verified source while preserving stale fallback",()=>{
 assert.match(html,/const candidate=seoDaily\?\.periods\?\.\[String\(period\)\]/);
 assert.match(html,/seoDaily\.gsc_latest_day/);
 assert.match(html,/既有舊公開快照/);
 assert.match(html,/data\.seo\["period"\+period\]/);
 assert.match(html,/chenyang:gsc-daily-ready/);
});

test("daily check only uses real published JSON and never claims live Google ranking",()=>{
 assert.match(js,/seo-daily-check\.json/);
 assert.match(js,/seo-daily-history\.json/);
 assert.match(js,/x\.no_mock===true/);
 assert.match(js,/x\.not_live_google_serp===true/);
 assert.match(js,/GSC 平均排名/);
 assert.match(js,/今天/);
 assert.doesNotMatch(js,/googleapis\.com\/searchconsole|api\.brightdata\.com|\/datasets\/v3\/trigger/);
});

test("history has meaningful date filtering and CSV and doesn't invent 0 rank",()=>{
 assert.match(js,/function renderHistory\(\)/);
 assert.match(js,/function exportHistory\(\)/);
 assert.match(js,/history\.entries/);
 assert.match(js,/\.slice\(0,count\)/);
 assert.match(js,/Number\(x\)\.toFixed\(2\)/);
 assert.match(js,/x=>x===null/);
});

test("both browser scripts compile",()=>{
 new Function(js);
 for(const match of html.matchAll(/<script(?:\s[^>]*)?>([\s\S]*?)<\/script>/gi)){
  new Function(match[1]);
 }
});
