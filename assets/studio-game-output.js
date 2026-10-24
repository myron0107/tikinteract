import {createOutputIdentity,outputLink,gatherICE} from './game-output-protocol.js?v=1';
import {connectOutputSignals} from './game-output-signaling.js?v=1';
let identity,identityOwner,identityPromise,stream,signals,starting=false,generation=0,target,originalWrap,preview,cursorMarker,localCursor;
const peers=new Map();
const owner=()=>window.tikInteractUser?.id;
export const outputSupported=()=>!!(window.isSecureContext&&navigator.mediaDevices?.getDisplayMedia&&window.RestrictionTarget?.fromElement&&window.RTCPeerConnection&&Element.prototype.moveBefore);
function cursorPreference(){try{return localStorage.getItem('tikinteract_game_output_cursor:'+owner())==='1';}catch{return false;}}
export function gameOutputState(){return{active:!!stream?.getVideoTracks().some(t=>t.readyState==='live'),starting,viewers:[...peers.values()].filter(p=>p.peer.connectionState==='connected').length,supported:outputSupported(),showCursor:cursorPreference()};}
function cursorStyle(){const doc=document.getElementById('live-game-frame')?.contentDocument;if(!doc?.head)return;let style=doc.getElementById('tikinteract-output-hide-cursor');if(stream&&!cursorPreference()){if(!style){style=doc.createElement('style');style.id='tikinteract-output-hide-cursor';style.textContent='html,body,body *{cursor:none!important}';doc.head.append(style);}}else style?.remove();}
export async function setGameOutputCursor(show){try{localStorage.setItem('tikinteract_game_output_cursor:'+owner(),show?'1':'0');}catch{}if(cursorMarker)cursorMarker.hidden=true;cursorStyle();await stream?.getVideoTracks()[0]?.applyConstraints({cursor:'never'});emit();}
function mountTarget(frame){
 originalWrap=frame.closest('.live-game-frame-wrap');target=document.createElement('div');target.id='studio-game-output-target';
 for(const name of ['--game-native-width','--game-native-height','--game-fit-scale'])target.style.setProperty(name,frame.style.getPropertyValue(name));
 target.className='is-output-parked';document.body.append(target);target.moveBefore(frame,null);const animation=originalWrap.querySelector('[data-scene-animation]');if(animation)target.moveBefore(animation,null);window.TikInteractStudioLayout?.fitGame();fitTarget();
}
function fitTarget(){const frame=target?.querySelector('iframe');if(frame)target.style.zoom=String(Math.min(1,Math.max(.1,(innerWidth-8)/frame.clientWidth),Math.max(.1,(innerHeight-8)/frame.clientHeight)));}
function mountPreview(track){
 preview=document.createElement('video');preview.className='studio-game-output-preview';preview.autoplay=true;preview.playsInline=true;preview.muted=true;preview.srcObject=new MediaStream([track]);preview.setAttribute('aria-label','Game preview');originalWrap.append(preview);void preview.play().catch(()=>{});
 cursorMarker=document.createElement('span');cursorMarker.className='studio-game-output-cursor';cursorMarker.hidden=true;cursorMarker.innerHTML='<svg viewBox="0 0 20 26" width="20" height="26"><path d="M1 1v20l5-5 4 9 4-2-4-9h8Z" fill="white" stroke="black" stroke-width="1.5"/></svg>';target.append(cursorMarker);
 localCursor=document.createElement('span');localCursor.className='studio-output-local-cursor';localCursor.innerHTML=cursorMarker.innerHTML;localCursor.hidden=true;document.body.append(localCursor);document.body.classList.add('studio-output-sharing');
 const position=e=>{const frame=document.getElementById('live-game-frame'),r=preview.getBoundingClientRect(),w=frame.clientWidth,h=frame.clientHeight,scale=Math.min(r.width/w,r.height/h),x=(e.clientX-r.left-(r.width-w*scale)/2)/scale,y=(e.clientY-r.top-(r.height-h*scale)/2)/scale;return{x,y,w,h,frame};};
 preview.addEventListener('pointermove',e=>{const p=position(e);cursorMarker.hidden=!cursorPreference()||p.x<0||p.y<0||p.x>p.w||p.y>p.h;cursorMarker.style.left=p.x+'px';cursorMarker.style.top=p.y+'px';});preview.addEventListener('pointerleave',()=>{cursorMarker.hidden=true;});
 preview.addEventListener('click',e=>{const p=position(e);p.frame.contentWindow.focus();if(p.x<0||p.y<0||p.x>p.w||p.y>p.h)return;const doc=p.frame.contentDocument,node=doc.elementFromPoint(p.x,p.y);node?.dispatchEvent(new p.frame.contentWindow.MouseEvent('click',{bubbles:true,clientX:p.x,clientY:p.y}));});
}
function unmountTarget(){preview?.pause();if(preview)preview.srcObject=null;preview?.remove();preview=null;cursorMarker=null;localCursor?.remove();localCursor=null;document.body.classList.remove('studio-output-sharing');const frame=target?.querySelector('#live-game-frame'),animation=target?.querySelector('[data-scene-animation]');if(frame&&originalWrap){originalWrap.moveBefore(frame,null);if(animation)originalWrap.moveBefore(animation,null);originalWrap.classList.toggle('is-empty',!frame.dataset.gameId||frame.hidden);}target?.remove();target=null;originalWrap=null;window.TikInteractStudioLayout?.fitGame();cursorStyle();}
function emit(error){window.dispatchEvent(new CustomEvent('tikinteract:game-output',{detail:{...gameOutputState(),error}}));}
export async function getGameOutputLink(){
 const user=owner();if(!user)throw Error('OUTPUT_LOGIN_REQUIRED');
 if(user!==identityOwner){identityOwner=user;identity=null;identityPromise=null;}
 if(!identity){identityPromise||=(async()=>{let saved;try{saved=JSON.parse(localStorage.getItem('tikinteract_game_output_v1:'+user));}catch{}const value=saved?.privateKey?.d&&saved?.publicKey?.x&&saved?.secret&&saved?.room?saved:await createOutputIdentity();if(owner()!==user)throw Error('OUTPUT_ACCOUNT_CHANGED');identity=value;try{localStorage.setItem('tikinteract_game_output_v1:'+user,JSON.stringify(value));}catch{}return value;})().catch(e=>{identityPromise=null;throw e;});await identityPromise;}
 return outputLink(identity,window.TikInteractStudioLayout?.getFormat());
}
function drop(id){const entry=peers.get(id);if(!entry)return;peers.delete(id);clearTimeout(entry.timer);entry.peer.close();emit();}
function sendViewport(entry){
 if(entry.channel?.readyState!=='open'||entry.channel.bufferedAmount>4096)return;
 const frame=document.getElementById('live-game-frame'),wrap=target;if(!wrap)return;
 const a=frame.getBoundingClientRect(),b=wrap.getBoundingClientRect();if(!a.width||!a.height||!b.width||!b.height)return;
 const value=JSON.stringify({type:'viewport',width:b.width,height:b.height,game:{x:a.left-b.left,y:a.top-b.top,width:a.width,height:a.height}});
 if(entry.viewport!==value){entry.channel.send(value);entry.viewport=value;}
}
async function receive(message){
 if(message.type!=='offer'||!/^[a-f0-9-]{36}$/.test(message.id)||typeof message.sdp!=='string'||message.sdp.length>24000||!stream)return;
 const version=generation,old=peers.get(message.id);if(old&&old.offer===message.sdp){if(old.answer)await signals?.send(old.answer);return;}drop(message.id);
 if(peers.size>=3)return;
 const peer=new RTCPeerConnection({iceServers:[]}),entry={peer,offer:message.sdp};peers.set(message.id,entry);
 entry.timer=setTimeout(()=>{if(peer.connectionState!=='connected')drop(message.id);},25000);
 peer.onconnectionstatechange=()=>{if(peers.get(message.id)!==entry)return;if(['failed','closed','disconnected'].includes(peer.connectionState))drop(message.id);else emit();};
 // The receiver gets crop geometry only; incoming messages never control a game.
 peer.ondatachannel=e=>{if(e.channel.label!=='viewport'){e.channel.close();return;}entry.channel=e.channel;e.channel.onopen=()=>sendViewport(entry);};
 try{
  await peer.setRemoteDescription({type:'offer',sdp:message.sdp});
  for(const track of stream.getTracks())peer.addTrack(track,stream);
  await peer.setLocalDescription(await peer.createAnswer());await gatherICE(peer);
  if(version!==generation||!stream||peers.get(message.id)!==entry){peer.close();return;}
  entry.answer={type:'answer',id:message.id,sdp:peer.localDescription.sdp};await signals.send(entry.answer);
 }catch{drop(message.id);}
}
export async function startGameOutput(){
 if(starting||gameOutputState().active)return;
 if(!owner())throw Error('OUTPUT_LOGIN_REQUIRED');
 if(!outputSupported())throw Error('OUTPUT_BROWSER_REQUIRED');
 const frame=document.getElementById('live-game-frame');
 if(!frame?.dataset.gameId||!frame.getAttribute('src'))throw Error('OUTPUT_SELECT_GAME');
 starting=true;emit();const user=owner(),version=++generation;let captured;
 try{
  // Obtain consent on this direct button click. Never publish the whole tab.
  captured=await navigator.mediaDevices.getDisplayMedia({preferCurrentTab:true,selfBrowserSurface:'include',surfaceSwitching:'exclude',systemAudio:'exclude',video:{displaySurface:'browser',cursor:'never',width:{ideal:1920,max:3840},height:{ideal:1920,max:3840},frameRate:{ideal:30,max:60}},audio:{suppressLocalAudioPlayback:false}});
  if(version!==generation||user!==owner())throw Error('OUTPUT_ACCOUNT_CHANGED');
  const track=captured.getVideoTracks()[0];if(!track?.restrictTo)throw Error('OUTPUT_BROWSER_REQUIRED');
  mountTarget(frame);const restriction=await RestrictionTarget.fromElement(target);await track.restrictTo(restriction);
  if(version!==generation||user!==owner())throw Error('OUTPUT_ACCOUNT_CHANGED');
  await getGameOutputLink();if(version!==generation||user!==owner())throw Error('OUTPUT_ACCOUNT_CHANGED');stream=captured;cursorStyle();mountPreview(track);
  track.addEventListener('ended',()=>{if(stream===captured)void stopGameOutput();},{once:true});
  const bus=await connectOutputSignals(identity,receive,{publisher:true});
  if(version!==generation||user!==owner()){await bus.close();throw Error('OUTPUT_ACCOUNT_CHANGED');}signals=bus;
  emit();
 }catch(error){captured?.getTracks().forEach(t=>t.stop());if(version===generation)await stopGameOutput();throw error;}
 finally{if(version===generation){starting=false;emit();}}
}
export async function stopGameOutput(){generation++;starting=false;const old=stream;stream=null;for(const id of [...peers.keys()])drop(id);const bus=signals;signals=null;old?.getTracks().forEach(t=>t.stop());unmountTarget();await bus?.close();emit();}
export async function rotateGameOutputLink(){await stopGameOutput();const user=owner();if(!user)throw Error('OUTPUT_LOGIN_REQUIRED');const next=await createOutputIdentity();if(user!==owner())throw Error('OUTPUT_ACCOUNT_CHANGED');identity=next;identityOwner=user;identityPromise=null;try{localStorage.setItem('tikinteract_game_output_v1:'+user,JSON.stringify(identity));}catch{}return getGameOutputLink();}
window.addEventListener('tikinteract:auth',()=>{if(identityOwner&&identityOwner!==owner()){void stopGameOutput();identity=null;identityPromise=null;identityOwner=null;}});
window.addEventListener('pagehide',()=>void stopGameOutput());
setInterval(()=>{if(stream){const frame=document.getElementById('live-game-frame'),playing=!!frame?.dataset.gameId&&!frame.hidden;if(preview)preview.hidden=!playing;if(!playing&&cursorMarker)cursorMarker.hidden=true;fitTarget();cursorStyle();}for(const entry of peers.values())sendViewport(entry);},250);
document.getElementById('live-game-frame')?.addEventListener('load',cursorStyle);
document.addEventListener('pointermove',e=>{if(localCursor){const parent=[...document.querySelectorAll('dialog[open]')].at(-1)||document.body;if(localCursor.parentElement!==parent)parent.append(localCursor);localCursor.hidden=e.pointerType==='touch';localCursor.style.left=e.clientX+'px';localCursor.style.top=e.clientY+'px';}},{passive:true});
document.documentElement.addEventListener('pointerleave',()=>{if(localCursor)localCursor.hidden=true;});
