import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
const source=readFileSync(new URL('../game.js',import.meta.url),'utf8');
const cut=(start,end)=>{const from=source.indexOf('function '+start+'('),to=source.indexOf('function '+end+'(',from);return source.slice(from,source.lastIndexOf('\n',to));};
function fixture(){
 const errors=[],sent=[],status={textContent:''},user={id:'local'},timers=new Map();let timer=0,saves=0;
 const input={value:'@fixture'},button={textContent:'Connect',dataset:{}};
 class Socket extends EventTarget{static OPEN=1;static CONNECTING=0;readyState=0;send(value){sent.push(JSON.parse(value));}open(){this.readyState=1;this.dispatchEvent(new Event('open'));}message(value){const e=new Event('message');Object.defineProperty(e,'data',{value:JSON.stringify(value)});this.dispatchEvent(e);}close(code=1000,reason=''){this.readyState=3;const event=new Event('close');Object.defineProperties(event,{code:{value:code},reason:{value:reason}});this.dispatchEvent(event);}}
 const win=Object.assign(new EventTarget(),{location:{origin:'https://tikinteract.vercel.app'},tikInteractUser:user,tikInteractAccessToken:'local-test-token',TikInteractLanguage:{get:()=> 'en'}});
 const context=vm.createContext({URL,setTimeout:fn=>{timers.set(++timer,fn);return timer;},clearTimeout:id=>timers.delete(id),setInterval:()=>1,clearInterval(){},WebSocket:Socket,CustomEvent:class extends Event{},console,localStorage:{setItem(){}},window:win,document:{getElementById:id=>id==='tiktok-user'?input:id==='tiktok-sync-status'?status:button},updateConnectionStatus(connected,username,connecting){button.dataset.connectionState=connecting?'connecting':connected?'connected':'disconnected';},saveTikTokProfileFromSettings(){saves++;},finishPlatformLiveSession:async()=>{},showConnectionError:m=>errors.push(m),openAuthModal(){},updateUI(){throw Error('LIVE cannot change website authentication');}});
 const api=vm.runInContext(`let socket=null,connectedUsername=null,liveDesiredUsername=null,liveReconnectTimer=null,liveStateTimer=null,liveRetryAttempt=0;${cut('showLiveVerificationIssue','sendStudioServerMessage')}${cut('sendStudioServerMessage','connectToLiveService')}${cut('connectToLiveService','waitForTikInteractLiveSession')}${cut('disconnectTikTokConnection','toggleTikTokConnection')}${cut('toggleTikTokConnection','lookupTikTokProfile')}({toggle:toggleTikTokConnection,socket:()=>socket})`,context);
 return {api,errors,sent,status,win,user,button,timers,saves:()=>saves,runTimer(){const [id,fn]=timers.entries().next().value;timers.delete(id);fn();}};
}
test('An interrupted online LIVE retries instead of asking for a local program',()=>{
 const {api,errors,sent}=fixture();api.toggle();const socket=api.socket();socket.open();assert(sent.some(m=>m.type==='connect'));socket.close();assert.deepEqual(errors,[]);
});
test('Failed initial transport retries; forbidden origins and expired sessions have distinct messages',()=>{
 let f=fixture();f.api.toggle();f.api.socket().close(1006);assert.equal(f.errors.length,0);assert.equal(f.timers.size,1);
 f=fixture();f.api.toggle();f.api.socket().open();f.api.socket().close(1008,'Origin not allowed');assert.equal(f.errors.length,1);assert.match(f.errors[0],/Originea/);
 f=fixture();f.api.toggle();f.api.socket().open();f.api.socket().close(1008,'Authentication required');assert.equal(f.errors.length,0);assert.match(f.status.textContent,/still signed in/);assert.equal(f.win.tikInteractUser,f.user);
});

test('Stop works in English while connecting and cancels hosting-rotation retries',()=>{
 const f=fixture();f.api.toggle();f.api.socket().open();assert.equal(f.sent.filter(m=>m.type==='connect').length,1);assert.equal(f.saves(),1);
 f.api.toggle();assert.equal(f.sent.at(-1).type,'disconnect');f.api.socket().close();assert.equal(f.timers.size,0);
 f.api.toggle();f.api.socket().open();f.api.socket().close(1012);assert.equal(f.timers.size,1);f.runTimer();f.api.socket().open();assert.equal(f.sent.filter(m=>m.type==='connect').length,3);
 f.api.socket().close(1006);f.api.toggle();assert.equal(f.timers.size,0);
});

test('Refreshed credentials reach an open LIVE socket and disconnected status preserves a TikTok error',()=>{
 const f=fixture();f.api.toggle();f.api.socket().open();f.win.tikInteractAccessToken='new-test-token';f.win.dispatchEvent(new Event('tikinteract:auth'));assert.equal(f.sent.at(-1).accessToken,'new-test-token');
 f.api.socket().message({type:'error',message:'Acest cont nu transmite LIVE acum.'});f.api.socket().message({type:'status',connected:false});assert.equal(f.errors.at(-1),'Acest cont nu transmite LIVE acum.');
});
test('Connector auth-required messages retain the website user/token and permit retry without opening login',()=>{
 const f=fixture();f.api.toggle();f.api.socket().open();f.api.socket().message({type:'auth-required'});
 assert.equal(f.win.tikInteractUser,f.user);assert.equal(f.win.tikInteractAccessToken,'local-test-token');assert.match(f.status.textContent,/still signed in/);assert.deepEqual(f.errors,[]);
 f.api.toggle();assert.equal(f.api.socket().readyState,0);
});
