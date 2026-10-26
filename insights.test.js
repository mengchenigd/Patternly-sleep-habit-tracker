import test from "node:test";
import assert from "node:assert/strict";
import { analyzeHistory } from "./public/insights.js";
test("pairs habits with the same night, preserves missing quality, gates small samples", () => {
  const rows = Array.from({ length: 9 }, (_, i) => ({
    date: `2026-01-${String(i + 1).padStart(2, "0")}`,
    screen: i % 2 ? 6 : 2,
    caffeine: i % 2 ? 200 : 50,
    exercise: i % 2 ? 10 : 40,
    sleep: i % 2 ? 8 : 6,
    sleep_quality: null,
  }));
  const r = analyzeHistory(rows, "2026-01-01", "2026-01-09")[0];
  assert.equal(r.n, 9);
  assert.equal(r.ready, true);
  assert.equal(r.low.value, 6);
  assert.equal(r.high.value, 8);
  assert.equal(r.qualityLow.value, null);
  assert.equal(
    analyzeHistory(rows, "2026-01-01", "2026-01-03")[0].ready,
    false,
  );
  assert.equal(
    analyzeHistory([rows[0], rows[2]], "2026-01-01", "2026-01-09")[0].n,
    2,
  );
});

import { strongestPattern } from './public/insights.js';
import { demoRecords } from './scripts/demo-records.js';
test('fictional 30 days select exercise; selection changes with real inputs',()=>{
 const rows=demoRecords('2026-09-22');
 assert.equal(rows.length,30);
 let results=analyzeHistory(rows,rows[0].date,rows.at(-1).date);
 assert.equal(strongestPattern(results).key,'exercise');
 assert.equal(results.find(r=>r.key==='exercise').n,30);
 assert.equal(results.find(r=>r.key==='water').state,'no-clear-difference');
 const switched=rows.map(r=>({...r,exercise:r.screen,screen:r.exercise}));
 results=analyzeHistory(switched,rows[0].date,rows.at(-1).date);
 assert.equal(strongestPattern(results).key,'screen');
 const missing=rows.map(r=>({...r,water:null}));
 assert.equal(analyzeHistory(missing,rows[0].date,rows.at(-1).date).find(r=>r.key==='water').n,0);
 const constant=rows.map(r=>({...r,exercise:0,caffeine:0,screen:0,water:0,mood:3}));
 results=analyzeHistory(constant,rows[0].date,rows.at(-1).date);
 assert.equal(strongestPattern(results),null);
 assert.ok(results.every(r=>r.state==='limited-variation'));
 assert.equal(strongestPattern(analyzeHistory(rows.slice(0,3),rows[0].date,rows.at(-1).date)),null);
});
test('water can lead, null sleep excluded, zero water retained, ranges respected',()=>{
 const base=demoRecords('2026-09-22');
 const rows=base.map(r=>({...r,water:r.exercise/10,exercise:10}));
 assert.equal(strongestPattern(analyzeHistory(rows,rows[0].date,rows.at(-1).date)).key,'water');
 const nullSleep=rows.map(r=>({...r,sleep:null}));
 assert.ok(analyzeHistory(nullSleep,rows[0].date,rows.at(-1).date).every(r=>r.n===0));
 const zeros=rows.map(r=>({...r,water:0}));
 assert.equal(analyzeHistory(zeros,rows[0].date,rows.at(-1).date).find(r=>r.key==='water').n,30);
 assert.ok(analyzeHistory(rows,'2026-09-20','2026-09-22').every(r=>r.n===(r.key==='mood'?2:3)&&!r.ready));
 assert.equal(strongestPattern(analyzeHistory([],rows[0].date,rows.at(-1).date)),null);
});

test('morning mood matches the previous night and is not ranked as a causal habit',()=>{
 const rows=Array.from({length:9},(_,i)=>({date:`2026-01-${String(i+1).padStart(2,'0')}`,mood:i%2?5:1,sleep:i%2?8:5,sleep_quality:null}));
 const results=analyzeHistory(rows,'2026-01-01','2026-01-09');
 const mood=results.find(r=>r.key==='mood');
 assert.equal(mood.n,8); assert.equal(mood.low.value,8); assert.equal(mood.high.value,5);
 assert.equal(mood.state,'association'); assert.equal(strongestPattern(results),null);
 const invalid=rows.map(r=>({...r,mood:null}));
 assert.equal(analyzeHistory(invalid,'2026-01-01','2026-01-09').find(r=>r.key==='mood').n,0);
});

 test('sleep difference must reach one hour to trigger an association',()=>{
  for (const [difference,state] of [[0.9,'no-clear-difference'],[1,'association'],[1.1,'association'],[-0.9,'no-clear-difference'],[-1,'association']]) {
   const rows=Array.from({length:9},(_,i)=>({date:`2026-01-${String(i+1).padStart(2,'0')}`,screen:i%2?6:2,sleep:i%2?6:6+difference}));
   const result=analyzeHistory(rows,'2026-01-01','2026-01-09').find(r=>r.key==='screen');
   assert.equal(result.state,state);
  }
 });
