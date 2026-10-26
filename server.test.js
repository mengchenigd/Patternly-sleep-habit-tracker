import { addDays, dateInZone } from './public/dates.js';
import test from 'node:test';
import assert from 'node:assert/strict';
import {DatabaseSync} from 'node:sqlite';
import {spawn} from 'node:child_process';
import {mkdtempSync} from 'node:fs';
import {tmpdir} from 'node:os';
import path from 'node:path';
const dbPath=path.join(mkdtempSync(path.join(tmpdir(),'patternly-auth-test-')),'users.sqlite');
const origin='http://127.0.0.1:4187';
async function start(){const child=spawn(process.execPath,['server.js'],{env:{...process.env,PORT:'4187',DB_PATH:dbPath,APP_ORIGIN:origin,NODE_ENV:'test',INVITE_CODE:'test-invitation'}});await new Promise((resolve,reject)=>{child.stdout.once('data',resolve);child.once('error',reject);child.once('exit',code=>reject(Error('Server exited '+code)));});return child;}
async function stop(child){await new Promise(resolve=>{child.once('exit',resolve);child.kill();});}
function client(){let cookie='';return {get cookie(){return cookie;},async call(route,body,extra={}){const response=await fetch(origin+'/api/'+route,{method:body?'POST':'GET',headers:{'Content-Type':'application/json',Origin:origin,Cookie:cookie,...extra},...(body?{body:JSON.stringify(body)}:{})});const received=response.headers.get('set-cookie');if(received)cookie=received.split(';')[0];return {status:response.status,body:await response.json(),cookie:received};}};}
test('authentication, account isolation, ownership and persistent sessions',async()=>{
 let child=await start();try{
 const alice=client(),bob=client(),anonymous=client();
 assert.equal((await anonymous.call('database')).status,401);
 assert.equal((await anonymous.call('admin/database')).status,401);
 assert.equal((await alice.call('auth/register',{username:'alice',password:'alice-test-password-123'})).status,403);
 const registration=await alice.call('auth/register',{username:'alice',password:'alice-test-password-123',invite_code:'test-invitation',is_admin:true,role:'admin'});
 assert.equal((await alice.call('admin/database')).status,403);
 assert.equal(registration.body.user.is_admin,false);
 assert.equal((await alice.call('auth/session')).body.user.is_admin,false);
 assert.equal(registration.status,200);assert.match(registration.cookie,/HttpOnly/);assert.match(registration.cookie,/SameSite=Lax/);
 assert.equal(registration.body.user.tutorial_completed_at,null);
 const tutorial=await alice.call('auth/tutorial-complete',{});
 assert.equal(tutorial.status,200);assert.ok(tutorial.body.user.tutorial_completed_at);
 assert.ok((await alice.call('auth/session')).body.user.tutorial_completed_at);
 assert.equal((await bob.call('auth/register',{username:'bob',password:'bob-test-password-123',invite_code:'test-invitation'})).status,200);
 const profile={name:'Alice',age_range:'25–34',schedule:'Regular daytime',bedtime:'22:00',wake_time:'07:00',sleep_target:8};
 assert.equal((await alice.call('profile',profile)).status,200);
 const record={date:'2026-01-01',caffeine:120,intake:'14:00',exercise:30,exercise_type:'Walking',screen:4,sleep:8,mood:4,sleep_quality:4};
 assert.equal((await alice.call('records',record)).status,200);
 assert.equal((await bob.call('records',{...record,user_id:registration.body.user.id,sleep:5})).status,200);
 assert.equal((await alice.call('database')).body.records[0].sleep,8);
 assert.equal((await bob.call('database')).body.records[0].sleep,5);
 assert.equal((await bob.call('database')).body.profiles.length,0);
 assert.equal((await alice.call('database')).body.records[0].water,null);
 assert.equal((await alice.call('records',{...record,water:1.75})).status,200);
 assert.equal((await alice.call('database')).body.records[0].water,1.75);
 assert.equal((await bob.call('database')).body.records[0].water,null);
 for(const water of [-1,21,'2']) assert.equal((await alice.call('records',{...record,water})).status,400);
 assert.equal((await bob.call('goals',{habit:'Water intake',goal:'Record my water',start_date:'2026-01-01',duration_days:7})).status,200);
 assert.equal((await bob.call('goals',{habit:'Other',goal:'My own routine',start_date:'2026-01-08',duration_days:7})).status,200);
 const result=await alice.call('goals',{habit:'Caffeine',goal:'Try a routine',start_date:'2026-01-01',duration_days:10});
 assert.equal(result.status,200);const id=result.body.goals[0].id;
 for (const [start,duration] of [['2026-01-01',7],['2026-01-10',1],['2025-12-31',2]]) {
  assert.equal((await alice.call('goals',{habit:'Exercise',goal:'Overlapping cycle',start_date:start,duration_days:duration})).status,409);
 }
 assert.equal((await alice.call('goals',{habit:'Exercise',goal:'Next cycle',start_date:'2026-01-11',duration_days:7})).status,200);

 assert.equal((await alice.call('checkins',{goal_id:id,date:'2026-01-10',met:true})).status,200);
 const edited=await alice.call('goals/update',{goal_id:id,habit:'Caffeine',goal:'Updated goal',start_date:'2026-01-01',duration_days:10});
 assert.equal(edited.status,200);
 assert.equal(edited.body.goals.find(goal=>goal.id===id).goal,'Updated goal');
 assert.equal(edited.body.checkins.length,1);
 assert.equal((await alice.call('goals/update',{goal_id:id,habit:'Caffeine',goal:'Shorten',start_date:'2026-01-01',duration_days:5})).status,400);
 assert.equal((await alice.call('goals/update',{goal_id:id,habit:'Caffeine',goal:'Overlap next',start_date:'2026-01-01',duration_days:11})).status,409);
 assert.equal((await bob.call('goals/update',{goal_id:id,habit:'Caffeine',goal:'Intrusion',start_date:'2026-01-01',duration_days:10})).status,400);

 assert.equal((await alice.call('checkins',{goal_id:id,date:'2026-01-11',met:true})).status,400);
 assert.equal((await bob.call('checkins',{goal_id:id,date:'2026-01-02',met:true})).status,400);
 assert.equal((await bob.call('reviews',{goal_id:id,reflection:'intrusion'})).status,400);
 assert.equal((await bob.call('checkins/cancel',{goal_id:id,date:'2026-01-10'})).status,400);
 assert.equal((await alice.call('checkins/cancel',{goal_id:id,date:'2026-01-10'})).status,200);
 assert.equal((await alice.call('database')).body.checkins.length,0);
 assert.equal((await alice.call('checkins',{goal_id:id,date:'2026-01-10',met:true})).status,200);
 assert.equal((await bob.call('database')).body.checkins.length,0);
 assert.equal((await alice.call('records',{...record,sleep:25})).status,400);
 assert.equal((await alice.call('records',{...record,date:'2026-02-30'})).status,400);
 assert.equal((await alice.call('records',{...record,date:'2999-01-01'})).status,400);
 assert.equal((await alice.call('records',record,{'X-Time-Zone':'invalid/zone'})).status,400);
 assert.equal((await alice.call('records',{...record,water:1.75},{'X-Time-Zone':'Pacific/Kiritimati'})).status,200);
 assert.equal((await alice.call('records',record,{Origin:'https://untrusted.example'})).status,403);
 for (const file of ['html.js', 'summary-chart.js', 'pattern-copy.js', 'insights.js', 'goal-progress.js', 'dates.js', 'record-calendar.js', 'form-controls.js', 'goal-cycle.js', 'summary-model.js', 'summary-view.js', 'forms-view.js', 'profile-view.js', 'track-view.js', 'admin-view.js']) {
   const response = await fetch(origin + '/' + file);
   assert.equal(response.status, 200, file + ' must be served');
   assert.match(response.headers.get('content-type'), /javascript/);
 }
 assert.equal((await fetch(origin+'/assets/missing.svg')).status,404);
 assert.equal((await alice.call('database')).status,200);
 assert.equal((await bob.call('goals/give-up',{goal_id:id})).status,400);
 assert.equal((await alice.call('goals/give-up',{goal_id:id})).status,200);
 const ended=(await alice.call('database')).body;
 assert.ok(ended.goals.find(g=>g.id===id).ended_at);
 assert.equal(ended.checkins.length,1);
 assert.equal((await alice.call('checkins',{goal_id:id,date:'2026-01-02',met:true})).status,400);
 assert.equal((await alice.call('goals/give-up',{goal_id:id})).status,200);
 const {intake:ignoredIntake,...withoutIntake}=record;
 assert.equal((await bob.call('records',{...withoutIntake,date:'2025-12-31'})).status,200);
 assert.equal((await bob.call('database')).body.records.find(r=>r.date==='2025-12-31').intake,null);
 const adminDb=new DatabaseSync(dbPath);
 adminDb.prepare('UPDATE users SET is_admin=1 WHERE username=?').run('bob');adminDb.close();
 const adminResult=await bob.call('admin/database');
 assert.equal(adminResult.status,200);assert.equal(adminResult.body.users.length,2);
 assert.equal(JSON.stringify(adminResult.body).includes('password_hash'),false);
 const oldCookie=bob.cookie;await bob.call('auth/logout',{});
 const replay=await fetch(origin+'/api/database',{headers:{Cookie:oldCookie}});assert.equal(replay.status,401);
 assert.equal((await bob.call('auth/login',{username:'alice',password:'wrong-test-password-123'})).status,401);
 assert.equal((await bob.call('auth/login',{username:'bob',password:'bob-test-password-123'})).status,200);
 await stop(child);child=await start();
 assert.equal((await alice.call('database')).body.records[0].sleep,8);
 assert.equal((await bob.call('database')).body.records[0].sleep,5);
 assert.equal((await alice.call('database')).body.records[0].water,1.75);
 assert.ok((await alice.call('database')).body.goals.find(g=>g.id===id).ended_at);
 assert.equal(JSON.stringify((await alice.call('database')).body).includes('password_hash'),false);
 const charlie=client();
 await charlie.call('auth/register',{username:'charlie',password:'charlie-test-password-123',invite_code:'test-invitation'});
 const today=dateInZone('UTC');
 const cycle=await charlie.call('goals',{habit:'Exercise',goal:'Current cycle',start_date:addDays(today,-5),duration_days:7});
 const currentId=cycle.body.goals[0].id;
 assert.equal((await charlie.call('goals',{habit:'Caffeine',goal:'Premature next cycle',start_date:addDays(today,7),duration_days:7})).status,409);
 assert.equal((await charlie.call('checkins',{goal_id:currentId,date:today,met:true})).status,200);
 assert.equal((await charlie.call('goals/give-up',{goal_id:currentId})).status,200);
 assert.equal((await charlie.call('goals',{habit:'Caffeine',goal:'Backdated overlap',start_date:addDays(today,-1),duration_days:7})).status,409);
 assert.equal((await charlie.call('goals',{habit:'Caffeine',goal:'Replacement cycle',start_date:today,duration_days:7})).status,200);

 }finally{await stop(child);}
});
