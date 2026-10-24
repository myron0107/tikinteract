import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
const source=readFileSync(new URL('../game.js',import.meta.url),'utf8');
const cut=(start,end)=>{const from=source.indexOf('function '+start+'('),to=source.indexOf('function '+end+'(',from);return source.slice(from,source.lastIndexOf('\n',to));};
function fixture(){
 const errors=[],sent=[],status={textContent:''},user={id:'local'};
 class Socket extends EventTarget{static OPEN=1;static CONNECTING=0;readyState=0;send(value){sent.push(JSON.parse(value));}open(){this.readyState=1;this.dispatchEvent(new Event('open'));}message(value){const e=new Event('message');Object.defineProperty(e,'data',{value:JSON.stringify(value)});this.dispatchEvent(e);}close(code=1000,reason=''){this.readyState=3;const event=new Event('close');Object.defineProperties(event,{code:{value:code},reason:{value:reason}});this.dispatchEvent(event);}}
 const win={tikInteractUser:user,tikInteractAccessToken:'local-test-token',TikInteractLanguage:{get:()=> 'en'},dispatchEvent(){}};
 const context=vm.createContext({WebSocket:Socket,CustomEvent:class{},console,localStorage:{setItem(){}},window:win,document:{getElementById:id=>id==='tiktok-user'?{value:'@fixture'}:id==='tiktok-sync-status'?status:{textContent:'Connect'}},updateConnectionStatus(){},finishPlatformLiveSession:async()=>{},showConnectionError:m=>errors.push(m),openAuthModal(){},updateUI(){throw Error('Connector cannot change website authentication');}});
 const api=vm.runInContext(`let socket=null,connectedUsername=null;${cut('showLiveVerificationIssue','sendStudioServerMessage')}${cut('sendStudioServerMessage','connectToLocalServer')}${cut('connectToLocalServer','waitForTikInteractLiveSession')}${cut('toggleTikTokConnection','lookupTikTokProfile')}({toggle:toggleTikTokConnection,socket:()=>socket})`,context);
 return {api,errors,sent,status,win,user};
}
test('A normally closed established LIVE socket never reports that the local server is missing',()=>{
 const {api,errors,sent}=fixture();api.toggle();const socket=api.socket();socket.open();assert(sent.some(m=>m.type==='connect'));socket.close();assert.deepEqual(errors,[]);
});
test('Failed initial transport produces one local-server error; forbidden origins and expired sessions have distinct messages',()=>{
 let f=fixture();f.api.toggle();f.api.socket().close(1006);assert.equal(f.errors.length,1);assert.match(f.errors[0],/serverul local/);
 f=fixture();f.api.toggle();f.api.socket().open();f.api.socket().close(1008,'Origin not allowed');assert.equal(f.errors.length,1);assert.match(f.errors[0],/Originea/);
 f=fixture();f.api.toggle();f.api.socket().open();f.api.socket().close(1008,'Authentication required');assert.equal(f.errors.length,0);assert.match(f.status.textContent,/still signed in/);assert.equal(f.win.tikInteractUser,f.user);
});
test('Connector auth-required messages retain the website user/token and permit retry without opening login',()=>{
 const f=fixture();f.api.toggle();f.api.socket().open();f.api.socket().message({type:'auth-required'});
 assert.equal(f.win.tikInteractUser,f.user);assert.equal(f.win.tikInteractAccessToken,'local-test-token');assert.match(f.status.textContent,/still signed in/);assert.deepEqual(f.errors,[]);
 f.api.toggle();assert.equal(f.api.socket().readyState,0);
});
