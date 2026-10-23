import test from 'node:test';
import assert from 'node:assert/strict';
import {createStudioSession} from '../assets/studio-session-model.js';
import {createLiveEventNormalizer} from '../lib/live-events.js';
test('Current-session tools consume actual normalized chat, batched likes and final gift totals once',()=>{
 const panel=createStudioSession(),normalize=createLiveEventNormalizer('live-1');
 assert.equal(panel.snapshot().viewers,null);assert.equal(panel.receive({type:'chat',eventId:'before',username:'a',message:'before'}),false);
 panel.receive({type:'status',connected:true,sessionId:'live-1',username:'creator'},1000);
 const chat=normalize('chat',{uniqueId:'viewer',comment:'Salut!',msgId:'chat-1'}),likes=normalize('like',{uniqueId:'viewer',likeCount:24,msgId:'likes-1'}),gift=normalize('gift',{uniqueId:'viewer',giftId:'rose',repeatCount:3,repeatEnd:true,groupId:'gift-1',giftType:1,diamondCount:2,giftName:'Rose'});
 for(const event of [chat,likes,gift]){assert.equal(panel.receive(event,2000),true);assert.equal(panel.receive(event,3000),false);}
 const s=panel.snapshot();assert.equal(s.chat[0].text,'Salut!');assert.equal(s.comments,1);assert.equal(s.likes,24);assert.equal(s.gifts,3);assert.equal(s.coins,6);assert.deepEqual(s.supporters,[{username:'viewer',gifts:3,coins:6}]);assert.equal(s.started,1000);
});
test('Session tools reject other sessions, test actions and incomplete streaks; viewers represent current audience',()=>{
 const p=createStudioSession();p.receive({type:'status',connected:true,sessionId:'s'});
 for(const extra of [{sessionId:'other'},{test:true},{simulated:true}])assert.equal(p.receive({type:'gift',eventId:crypto.randomUUID(),username:'x',repeatCount:4,diamondCount:100,...extra}),false);
 assert.equal(p.receive({type:'gift',giftType:1,repeatEnd:false,eventId:'open'}),false);
 p.receive({type:'audience',viewerCount:12});p.receive({type:'audience',viewerCount:4});assert.equal(p.snapshot().viewers,4);assert.equal(p.snapshot().peak,12);
 for(const value of [null,undefined,'',-1,'unknown'])assert.equal(p.receive({type:'audience',viewerCount:value}),false);
 assert.equal(p.snapshot().viewers,4);
 p.receive({type:'status',connected:false});assert.equal(p.snapshot().viewers,null);
 p.receive({type:'status',connected:true,sessionId:'new'});assert.equal(p.snapshot().peak,null);assert.equal(p.snapshot().gifts,0);
});
test('Private session buffers are bounded and an account reset discards all audience data',()=>{
 const p=createStudioSession();p.receive({type:'status',connected:true,sessionId:'s'});
 for(let i=0;i<100;i++)p.receive({type:'chat',eventId:'m'+i,username:'a',message:'hello '+i});assert.equal(p.snapshot().chat.length,60);assert.equal(p.snapshot().chat[0].text,'hello 99');
 const snapshot=p.snapshot();snapshot.chat.length=0;assert.equal(p.snapshot().chat.length,60);
 p.reset();assert.equal(p.snapshot().sessionId,null);assert.equal(p.snapshot().chat.length,0);assert.equal(p.snapshot().viewers,null);
});
