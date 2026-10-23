import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';

test('AI state survives same-account auth refreshes and is discarded on account changes',async()=>{
 const events={};let requests=0;
 const window={tikInteractUser:{id:'first'},addEventListener:(type,fn)=>events[type]=fn,dispatchEvent(){}};
 const context=vm.createContext({window,Date,Error,CustomEvent:class{},animationAPI:async()=>({request:++requests,user:window.tikInteractUser.id})});
 const source=readFileSync(new URL('../assets/animations-state.js',import.meta.url),'utf8').replace(/^import .*\r?\n/,'').replace('export async function','async function');
 vm.runInContext(source+'\nglobalThis.load=loadAnimationState;',context);
 const first=await context.load();events['tikinteract:auth']();
 assert.equal(await context.load(),first);assert.equal(requests,1,'Token and preference updates do not invalidate the current workspace');
 window.tikInteractUser={id:'second'};events['tikinteract:auth']();
 const second=await context.load();assert.equal(second.user,'second');assert.equal(requests,2);
 window.tikInteractUser=null;events['tikinteract:auth']();await assert.rejects(context.load(),/ANIM_LOGIN_REQUIRED/);
});
