import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,statSync} from 'node:fs';
import {WORLDS,defaultDemoState,readDemoState,serializableDemoState,matchDemoRules,validateDemoFile} from '../assets/animations-demo-model.js';

test('all eight demo universes include local artwork, thumbnails and playable video containers',()=>{
 assert.equal(WORLDS.length,8);
 for(const w of WORLDS)for(const ext of ['.jpg','-thumb.jpg','.webm']){
  const file=new URL('../assets/animations-demo/'+w.id+ext,import.meta.url);
  assert(statSync(file).size>1000);
  if(ext==='.webm')assert.equal(readFileSync(file).subarray(0,4).toString('hex'),'1a45dfa3');
 }
});
test('only explicitly simulated events match gift, user, threshold or manual rules',()=>{
 const {rules}=defaultDemoState();rules.push({id:'manual',type:'manual',clip:'example-throne',enabled:true});
 const event={type:'gift',gift:'rose',quantity:1,user:'@DEMO_FAN',coins:1000};
 assert.deepEqual(matchDemoRules(rules,event),[]);
 assert.deepEqual(matchDemoRules(rules,{...event,demo:true}).map(r=>r.id),['example-gift','example-fan','example-threshold']);
 assert.deepEqual(matchDemoRules(rules,{demo:true,type:'manual',rule:'manual'}).map(r=>r.id),['manual']);
 rules[0].enabled=false;
 assert.deepEqual(matchDemoRules(rules,{...event,demo:true,coins:999,user:'other'}),[]);
});
test('gift quantities and thresholds are compared against the configured minimum',()=>{
 const rule={id:'r',type:'gift',gift:'rose',threshold:3,enabled:true};
 assert.equal(matchDemoRules([rule],{demo:true,type:'gift',gift:'rose',quantity:2}).length,0);
 assert.equal(matchDemoRules([rule],{demo:true,type:'gift',gift:'rose',quantity:3}).length,1);
 assert.equal(matchDemoRules([rule],{demo:true,type:'gift',gift:'galaxy',quantity:100}).length,0);
});
test('persistent demo settings exclude uploaded files, blob URLs, photos and rules for session-only clips',()=>{
 const state=defaultDemoState();state.library.push({id:'local',kind:'local',url:'blob:private'});
 state.library[0].url='blob:private';state.photo='blob:private';state.rules.push({id:'local-rule',clip:'local'});
 const saved=serializableDemoState(state);
 assert(!JSON.stringify(saved).includes('blob:'));
 assert.equal(saved.library.length,3);assert.equal(saved.rules.length,3);
 assert.deepEqual(readDemoState(saved),defaultDemoState());
});
test('corrupt local state cannot restore remote media, unknown universes or broken rule references',()=>{
 const state=serializableDemoState(defaultDemoState());
 state.world='unknown';state.duration=900;state.library.push({id:'bad',kind:'local',world:'vampire',url:'https://example.invalid'});
 state.rules.push({id:'bad-rule',clip:'missing',enabled:true,type:'manual'});
 const restored=readDemoState(state);
 assert.equal(restored.world,'vampire');assert.equal(restored.duration,5);
 assert.equal(restored.library.length,3);assert.equal(restored.rules.length,3);
 assert.deepEqual(readDemoState({version:99}),defaultDemoState());
});
test('file limits accept supported local media and reject empty, oversized or unexpected types',()=>{
 assert(validateDemoFile({type:'image/jpeg',size:5000},'image'));
 assert(!validateDemoFile({type:'image/svg+xml',size:5000},'image'));
 assert(!validateDemoFile({type:'image/png',size:11*1024*1024},'image'));
 assert(validateDemoFile({type:'video/webm',size:5000},'video'));
 assert(!validateDemoFile({type:'video/mp4',size:101*1024*1024},'video'));
 assert(!validateDemoFile({type:'video/mp4',size:0},'video'));
});
test('the animation module has no AI, payment, database, socket or OBS transport calls',()=>{
 const module=readFileSync(new URL('../assets/studio-animations.js',import.meta.url),'utf8');
 assert(!/\b(?:fetch|WebSocket|XMLHttpRequest)\s*\(|\.postMessage\s*\(|\.rpc\s*\(|\.from\s*\(/.test(module));
 const html=readFileSync(new URL('../live-studio.html',import.meta.url),'utf8');
 assert(html.includes('studio-animations-entry.js'));
 assert(!html.includes('tikinteract-animations-template/index.html'));
});
