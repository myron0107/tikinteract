import test from 'node:test';
import assert from 'node:assert/strict';
import {EventEmitter} from 'node:events';
import {attachLiveSocket,liveFailure} from '../lib/live-socket-session.js';
import {UserOfflineError} from 'tiktok-live-connector';
const tick=()=>new Promise(r=>setImmediate(r));
function fixture({allowed=true,defer=false,reject=null,...timing}={}){
 const created=[];
 class Socket extends EventEmitter{readyState=1;messages=[];send(raw){this.messages.push(JSON.parse(raw));}close(code,reason){this.closeCode=code;this.closeReason=reason;this.readyState=3;this.emit('close');}}
 const auth={isAuthorized:s=>!!s.studioAuth,async authorize(s,token){if(!allowed||!['verified-token','other-owner-token'].includes(token))return false;s.studioAuth={userId:token==='other-owner-token'?'other-owner':'owner',token};return true;}};
 const socket=new Socket();
 const session=attachLiveSocket(socket,{auth,events:{CHAT:'chat',LIKE:'like',GIFT:'gift',ROOM_USER:'audience',STREAM_END:'end'},createConnection(name,options){
  const c=Object.assign(new EventEmitter(),{name,options,isConnected:false,roomInfo:{data:{owner:{nickname:name,avatar_larger:{url_list:['https://example.invalid/'+name+'.webp']}}}},async disconnect(){this.isConnected=false;this.emit('disconnected');},async connect(){if(reject)throw reject;if(defer)await new Promise(r=>{this.release=r;});this.isConnected=true;}});created.push(c);return c;
 },...timing});
 const send=async(type,extra={})=>{socket.emit('message',JSON.stringify({type,accessToken:'verified-token',...extra}));await tick();await tick();};
 return {socket,session,created,send};
}
test('Online LIVE requires verified authorization before TikTok requests and closes idle unauthenticated sockets',async()=>{
 const f=fixture({allowed:false});await f.send('connect',{username:'creator'});assert.equal(f.created.length,0);assert.equal(f.socket.closeCode,1008);
 const idle=fixture({authTimeout:5});await new Promise(r=>setTimeout(r,15));assert.equal(idle.socket.closeCode,1008);
});
test('Two users never receive each other’s events, state or stop commands',async()=>{
 const a=fixture(),b=fixture();try{
 await a.send('connect',{username:'alpha'});await b.send('connect',{username:'beta'});
 a.created[0].emit('chat',{uniqueId:'viewer',comment:'only alpha',msgId:'1'});
 assert(a.socket.messages.some(m=>m.type==='chat'&&m.message==='only alpha'));assert(!b.socket.messages.some(m=>m.type==='chat'));
 await a.send('disconnect');assert.equal(b.created[0].isConnected,true);assert.equal(b.session.state().username,'beta');
 assert.equal(a.created[0].options.processInitialData,false,'Reconnecting must not replay previous gifts');
 assert.equal(b.session.state().avatarUrl,'https://example.invalid/beta.webp');
 }finally{a.session.close();b.session.close();}
});
test('Stop invalidates a slow earlier TikTok connection and its later events',async()=>{
 const f=fixture({defer:true});try{
 await f.send('connect',{username:'alpha'});const old=f.created[0];await f.send('disconnect');old.release();await tick();assert.equal(old.isConnected,false);assert.equal(f.session.state().connected,false);
 await f.send('connect',{username:'beta'});f.created[1].release();await tick();old.emit('chat',{uniqueId:'viewer',comment:'stale'});assert(!f.socket.messages.some(m=>m.message==='stale'));
 }finally{f.session.close();}
});
test('Switching authenticated accounts on the same socket discards the previous owner’s LIVE',async()=>{
 const f=fixture();try{
 await f.send('connect',{username:'alpha'});await f.send('state',{accessToken:'other-owner-token'});
 assert.equal(f.session.state().username,null);assert.equal(f.created[0].isConnected,false);
 f.created[0].emit('chat',{uniqueId:'viewer',comment:'private old session'});assert(!f.socket.messages.some(m=>m.message==='private old session'));
 }finally{f.session.close();}
});
test('Offline profiles produce a useful reason without inventing a successful LIVE',async()=>{
 const error=Object.assign(new Error('offline'),{name:'UserOfflineError'}),f=fixture({reject:error});try{
 await f.send('connect',{username:'alpha'});assert(f.socket.messages.some(m=>m.code==='NOT_LIVE'));assert.equal(f.session.state().connected,false);
 assert.equal(liveFailure({name:'SignatureRateLimitError'}).code,'TIKTOK_RATE_LIMIT');
 assert.equal(liveFailure(new UserOfflineError('User is offline')).code,'NOT_LIVE');
 }finally{f.session.close();}
});
test('Hosting rotation releases the TikTok connection and requests a browser reconnect',async()=>{
 const f=fixture({rotateAfter:15});await f.send('connect',{username:'alpha'});await new Promise(r=>setTimeout(r,30));assert.equal(f.socket.closeCode,1012);assert.equal(f.created[0].isConnected,false);assert(f.socket.messages.some(m=>m.type==='reconnect'));
});
