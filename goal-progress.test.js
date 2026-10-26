import test from 'node:test';
import assert from 'node:assert/strict';
import {completesCycleOnCheckIn, giveUpMessage} from './public/goal-progress.js';
test('a congratulatory completion occurs only for a positive final-day check-in',()=>{
 const goal={start_date:'2026-01-31',duration_days:3};
 assert.equal(completesCycleOnCheckIn(goal,'2026-02-02',true),true);
 assert.equal(completesCycleOnCheckIn(goal,'2026-02-01',true),false);
 assert.equal(completesCycleOnCheckIn(goal,'2026-02-02',false),false);
 assert.equal(completesCycleOnCheckIn({...goal,ended_at:'2026-02-01T00:00:00Z'},'2026-02-02',true),false);
});
test('give up wording changes on calendar day three, including month boundaries',()=>{
 for(const date of ['2026-01-31','2026-02-01']) assert.equal(giveUpMessage('2026-01-31',date),'Just started! Are you sure?');
 assert.equal(giveUpMessage('2026-01-31','2026-02-02'),'Almost there! Are you sure?');
 assert.equal(giveUpMessage('2026-01-31','2026-02-15'),'Almost there! Are you sure?');
});
import {weeklySleepQuality} from './public/goal-progress.js';
import {weeklySleepDuration, averageSleepQuality} from './public/goal-progress.js';
test('Track compares nightly hours and averages only valid ratings during this goal',()=>{
 const goal={start_date:'2026-10-04',duration_days:7};
 const rows=[
  {date:'2026-10-03',sleep:6,sleep_quality:1},
  {date:'2026-10-04',sleep:0,sleep_quality:3},
  {date:'2026-10-05',sleep:7.7,sleep_quality:4},
  {date:'2026-10-06',sleep:null,sleep_quality:null},
  {date:'2026-10-07',sleep:8,sleep_quality:5},
 ];
 const weeks=weeklySleepDuration(rows,goal,'2026-10-06');
 assert.deepEqual(weeks.current.map(row=>row.value),[0,7.7,null,null,null,null,null]);
 assert.equal(weeks.previous.at(-1).value,6);
 assert.equal(averageSleepQuality(rows,goal,'2026-10-06'),3.5);
 assert.equal(averageSleepQuality([],goal,'2026-10-06'),null);
});
test('weekly chart aligns goal weeks and leaves future and missing ratings blank',()=>{
 const goal={start_date:'2026-09-19',duration_days:14};
 const rows=[{date:'2026-09-13',sleep_quality:2},{date:'2026-09-20',sleep_quality:3},{date:'2026-09-21',sleep_quality:4},{date:'2026-09-22',sleep_quality:4},{date:'2026-09-23',sleep_quality:5}];
 const result=weeklySleepQuality(rows,goal,'2026-09-22');
 assert.equal(result.previous[0].date,'2026-09-12');
 assert.deepEqual(result.current.map(r=>r.value),[null,3,4,4,null,null,null]);
 assert.equal(weeklySleepQuality(rows,goal,'2026-09-27').current[0].date,'2026-09-26');
});
