import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';

function boot({studio=false,stored={},search='',denied=false}={}){
 const events={},timers=new Map(),attributes=new Map(),frames=[];
 const root={dataset:studio?{paletteScope:'studio'}:{},classList:{toggle(){}},setAttribute:(k,v)=>attributes.set(k,v),removeAttribute:k=>attributes.delete(k)};
 const window={addEventListener:(k,fn)=>events[k]=fn,dispatchEvent(){}};
 let sequence=0;
 const ctx={window,document:{documentElement:root,fonts:{ready:Promise.resolve()}},localStorage:{getItem:key=>{if(denied)throw Error('Storage disabled');return stored[key];}},location:{search},URLSearchParams,Promise,Set,CustomEvent:class{},setTimeout:fn=>{timers.set(++sequence,fn);return sequence;},clearTimeout:id=>timers.delete(id),requestAnimationFrame:fn=>frames.push(fn)};
 vm.runInNewContext(readFileSync(new URL('../assets/page-startup.js',import.meta.url),'utf8'),ctx);
 return{root,window,events,timers,attributes,async paint(){await Promise.resolve();await Promise.resolve();while(frames.length)frames.shift()();}};
}
test('startup uses saved language and mode immediately; public palette stays Burgundy',async()=>{
 const s=boot({stored:{tikinteract_language:'en',tikinteract_mode:'light',tikinteract_brand:'blue'}});
 assert.equal(s.root.lang,'en');assert.equal(s.root.dataset.mode,'light');assert.equal(s.root.dataset.theme,'burgundy');
 s.window.TikInteractStartup.ready('layout');await s.paint();assert.equal(s.root.dataset.uiReady,undefined);
 s.window.TikInteractStartup.ready('language');await s.paint();assert.equal(s.root.dataset.uiReady,'ready');assert(!('uiPending' in s.root.dataset));
});
test('Studio reveals after its static layout, locale and actual account decision are ready',async()=>{
 const s=boot({studio:true,stored:{tikinteract_brand:'blue'}});
 s.window.tikInteractUser={id:'fixture'};let status=null;s.window.TikInteractAccount={getStatus:()=>status};
 for(const part of ['language','layout','auth'])s.window.TikInteractStartup.ready(part);
 await s.paint();assert('uiPending' in s.root.dataset);assert.equal(s.root.dataset.theme,'blue');
 status={allowed:true};s.events['tikinteract:account-status']();await s.paint();assert.equal(s.root.dataset.uiReady,'ready');
});
test('blocked storage has safe defaults and a language URL override still works',()=>{
 const s=boot({denied:true,search:'?lang=ro'});assert.equal(s.root.lang,'ro');assert.equal(s.root.dataset.mode,'dark');assert.equal(s.root.dataset.theme,'burgundy');
});
test('missing initialization cannot leave the page invisible indefinitely; restored pages reveal',()=>{
 const s=boot({studio:true});s.timers.get(1)();assert.equal(s.root.dataset.uiReady,'fallback');assert(!('uiPending' in s.root.dataset));
 const restored=boot();restored.events.pageshow({persisted:true});assert.equal(restored.root.dataset.uiReady,'restored');
});
