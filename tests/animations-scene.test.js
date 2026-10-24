import test from 'node:test';
import assert from 'node:assert/strict';
import {matchesAnimationRule} from '../assets/animations-live-rules.js';
import {createAnimationFixture} from './helpers/animations-fixture.mjs';
import {createAnimationService} from '../lib/animations-service.js';

test('Gift and coin rules apply to everyone by default, or to an optional matching user',()=>{
 const event={type:'gift',giftId:'5655',giftName:'Rose',repeatCount:2,coins:200,username:'@VIEWER'};
 for(const r of [{type:'gift',gift:'5655',threshold:2},{type:'threshold',threshold:100}]){
  const rule={...r,enabled:true};assert.equal(matchesAnimationRule(rule,event),true);
  assert.equal(matchesAnimationRule({...rule,username:'viewer'},event),true);
  assert.equal(matchesAnimationRule({...rule,username:'someone.else'},event),false);
  assert.equal(matchesAnimationRule(rule,{...event,demo:true}),false);
 }
 assert.equal(matchesAnimationRule({type:'manual',enabled:true},event),false);
 assert.equal(matchesAnimationRule({type:'user',username:'',enabled:true},event),false);
});
test('Uploaded personal videos need no fan, have private playback/download, optional-user triggers and one reusable overlay',async()=>{
 const f=await createAnimationFixture();try{
  const s=createAnimationService({store:f.store,provider:f.provider,approved:false,siteUrl:'http://127.0.0.1:3033'}),path=f.user.id+'/personal.mp4';f.files.set(path,f.video);
  const media=await f.store.insert('animation_media',{user_id:f.user.id,path,mime:'video/mp4',bytes:f.video.length,title:'My personal video',world:'vampire',format:'9:16',kind:'upload',ready:true});
  assert((await s.command(f.user,{action:'playback',id:media.id})).url);assert((await s.command(f.user,{action:'download',id:media.id})).url);
  await s.command(f.user,{action:'rename',id:media.id,title:'  My renamed animation  '});
  assert.equal((await f.store.one('animation_media',{id:media.id})).title,'My renamed animation');
  assert.equal((await f.store.one('animation_media',{id:media.id})).path,path);
  await assert.rejects(s.command({id:crypto.randomUUID()},{action:'rename',id:media.id,title:'Not mine'}),/ANIM_NOT_FOUND/);
  for(const title of ['', '   ','x'.repeat(101),'bad\nname'])await assert.rejects(s.command(f.user,{action:'rename',id:media.id,title}),/ANIM_INVALID/);
  await assert.rejects(s.command({id:crypto.randomUUID()},{action:'playback',id:media.id}),/ANIM_NOT_FOUND/);
  await s.command(f.user,{action:'saveRule',clip:media.id,type:'threshold',threshold:100,username:'@Viewer',enabled:true});
  const event={type:'gift',eventId:'other',timestamp:Date.now(),username:'other',coins:200,repeatCount:1};
  assert.equal((await s.command(f.user,{action:'event',event})).queued,0);
  assert.equal((await s.command(f.user,{action:'event',event:{...event,eventId:'correct',username:'VIEWER'}})).queued,1);
  await assert.rejects(s.command(f.user,{action:'saveRule',clip:media.id,type:'gift',gift:'Rose',threshold:1,username:'invalid/name'}),/ANIM_INVALID/);
  assert.equal((await s.command(f.user,{action:'event',manual:true,clip:media.id,requestId:crypto.randomUUID()})).queued,1);
  const link=await s.command(f.user,{action:'overlayToken'}),token=new URL(link.url).hash.slice(1);
  assert.equal((await s.command(f.user,{action:'overlayStatus',token})).matches,true);
  assert.equal((await s.command(f.user,{action:'overlayStatus',token:'wrong'})).matches,false);
  assert((await s.overlay({token})).clip);assert.equal((await s.command(f.user,{action:'overlayStatus',token})).matches,true);
  assert.equal(f.calls.length,0,'Playback and rules never start AI calls');
 }finally{await f.db.close();}
});
