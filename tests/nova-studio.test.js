import test from 'node:test';
import assert from 'node:assert/strict';
import {GiftBindings} from '../GAME/NEON-ASCENT/src/studio-integration.js';
const gift={type:'gift',eventId:'gift-1',sessionId:'session',giftId:'rose',giftName:'Rose',username:'alice',displayName:'Alice',repeatCount:3,diamondCount:10,coins:30,giftType:1,repeatEnd:true};
test('Nova bindings match real gift IDs and preserve quantity independently from coins',()=>{
  const calls=[],bindings=new GiftBindings(payload=>{calls.push(payload);return true;});
  assert.equal(bindings.receive(gift),false);assert.equal(bindings.set('meteor','rose').ok,true);
  assert.equal(bindings.receive(gift),true);assert.equal(calls[0].action,'meteor');assert.equal(calls[0].amount,3);
  assert.equal(calls[0].actor.username,'alice');assert.equal(calls[0].commandId,'live:session:gift-1');
  assert.equal(bindings.receive({...gift,repeatEnd:false}),false);assert.equal(bindings.receive({...gift,type:'chat'}),false);
});
test('one TikTok gift activates one power and mappings persist across reloads',()=>{
  let saved=null;const storage={getItem:()=>saved,setItem:(key,value)=>{saved=value;}};
  const first=new GiftBindings(()=>true,storage);first.set('meteor','rose');
  assert.equal(first.set('vortex','rose').ok,false);assert.equal(first.set('vortex','galaxy').ok,true);
  const second=new GiftBindings(()=>true,storage);assert.deepEqual(second.bindings,{meteor:'rose',vortex:'galaxy'});
  assert.equal(second.set('meteor','').ok,true);assert(!Object.hasOwn(second.bindings,'meteor'));
});
test('bad storage and failed writes leave working mappings intact',()=>{
  const broken=new GiftBindings(()=>true,{getItem:()=>'{',setItem(){throw Error('full');}});
  assert.deepEqual(broken.bindings,{});assert.equal(broken.set('meteor','rose').ok,false);assert.deepEqual(broken.bindings,{});
  assert.equal(broken.set('unknown','rose').ok,false);
});
