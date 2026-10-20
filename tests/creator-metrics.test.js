import test from'node:test';import assert from'node:assert/strict';import vm from'node:vm';import{readFileSync}from'node:fs';
const source=readFileSync(new URL('../assets/creator-metrics.js',import.meta.url),'utf8').replace(/^import[^\n]+\n/,'');
test('LIVE metrics retain real counts, deduplicate events, drain all participants and stop after account changes',async()=>{
 const listeners={},calls=[];const window={tikInteractUser:{id:'owner'},addEventListener(type,fn){listeners[type]=fn;}};
 const context={window,document:{addEventListener(){},hidden:false},setInterval(){},rpc:async(name,args)=>{calls.push(structuredClone(args));}};
 vm.createContext(context);vm.runInContext(source,context);const emit=(type,detail)=>listeners[type]({detail});
 emit('tikinteract:session-started',{session:'session-one',user:'owner'});await window.TikInteractMetrics.flush();calls.length=0;
 for(let i=0;i<425;i++)emit('tikinteract:live-event',{type:'chat',username:'viewer'+i,eventId:'chat'+i});
 emit('tikinteract:live-event',{type:'chat',username:'viewer1',eventId:'chat1'});
 emit('tikinteract:live-event',{type:'like',likeCount:25,eventId:'like1'});emit('tikinteract:live-event',{type:'like',likeCount:25,eventId:'like1'});
 emit('tikinteract:live-event',{type:'audience',viewerCount:35});emit('tikinteract:live-event',{type:'audience',viewerCount:20});
 emit('tikinteract:live-event',{type:'like',likeCount:Infinity});await window.TikInteractMetrics.flush();
 assert.equal(calls.length,3);assert.equal(calls.flatMap(c=>c.p_people).length,425);assert(calls.every(c=>c.p_people.length<=200));assert.equal(calls.at(-1).p_chat,425);assert.equal(calls.at(-1).p_likes,25);assert.equal(calls.at(-1).p_peak,35);
 const before=calls.length;window.tikInteractUser={id:'another'};emit('tikinteract:auth');await window.TikInteractMetrics.flush();assert.equal(calls.length,before);
});
