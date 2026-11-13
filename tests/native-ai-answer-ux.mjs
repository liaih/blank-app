import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";

const html=readFileSync(new URL("../docs/monitor.html",import.meta.url),"utf8");
const data=JSON.parse(readFileSync(new URL("../docs/native-ai-summary.json",import.meta.url),"utf8"));

test("AI SEO opens with actual answer excerpts before charts",()=>{
 const answer=html.indexOf('id="native-public-tests"');
 const chart=html.indexOf('id="native-chatgpt"');
 assert.ok(answer>0 && chart>0 && answer<chart,
  "actual answer text must be visible before KPI charts");
 assert.equal(html.split('id="native-public-tests"').length-1,1,
  "only one live answer container must exist");
 assert.match(html,/details\.open=tests\.childElementCount<2/,
  "first two actual answers must not be hidden behind a click");
});
test("every displayed answer comes from verifiable published evidence data",()=>{
 assert.match(html,/data\.public_test_samples/);
 assert.match(html,/sample\.answer_excerpt/);
 assert.match(html,/sample\.answered_at/);
 assert.match(html,/sample\.evidence_id/);
 assert.match(html,/sample\.cited_domains/);
 assert.match(html,/sample\.prompt/);
 assert.ok(Array.isArray(data.public_test_samples));
 assert.ok(data.public_test_samples.every(x=>x.platform && x.answered_at && x.answer_excerpt));
});
test("today's missing data is labelled missing, historical not promoted as current",()=>{
 assert.match(html,/id="native-ai-today"/);
 assert.match(html,/taiwanToday=new Date\(Date\.now\(\)\+8\*3600000\)/);
 assert.match(html,/尚無新 AI 平台回答/);
 assert.match(html,/不可冒充今日監測/);
 assert.match(html,/今天/);
 assert.equal(data.not_real_consumer_query_volume,true);
});

test("published evidence refresh is read-only and preserves opened answers",()=>{
 assert.match(html,/window\.setInterval\(\(\)=>\{/);
 assert.match(html,/120000\)/);
 assert.match(html,/lastNativeResultVersion/);
 assert.match(html,/latestVersion===lastNativeResultVersion/);
 assert.match(html,/fetch\("\.\/native-ai-summary\.json",\{cache:"no-store"\}\)/);
 const task=html.slice(html.indexOf("window.setInterval(()=>{"),html.indexOf("function renderDailyAISummary(){"));
 assert.doesNotMatch(task, /api\.brightdata\.com|datasets\/v3\/trigger|new XMLHttpRequest/);
});
