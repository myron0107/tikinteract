import {parseOutputLink,gatherICE} from './game-output-protocol.js?v=1';
import {connectOutputSignals} from './game-output-signaling.js?v=1';
const video=document.getElementById('game-output'),status=document.getElementById('status');
let identity,signals,peer,id,timer,stopped=false,retrying=false;
let viewport;
const stage=document.createElement('div');stage.id='stage';video.before(stage);stage.append(video);
function fit(){if(!viewport)return;const g=viewport.game,scale=Math.min(innerWidth/g.width,innerHeight/g.height);stage.style.cssText=`position:absolute;overflow:hidden;left:${(innerWidth-g.width*scale)/2}px;top:${(innerHeight-g.height*scale)/2}px;width:${g.width}px;height:${g.height}px;transform-origin:0 0;transform:scale(${scale})`;video.style.cssText=`position:absolute;max-width:none;width:${viewport.width}px;height:${viewport.height}px;left:${-g.x}px;top:${-g.y}px;object-fit:fill`;}
window.addEventListener('resize',fit);
function note(text){status.textContent=text;status.hidden=false;}
async function connect(){
 if(stopped||retrying)return;retrying=true;clearTimeout(timer);const previous=peer;peer=null;previous?.close();video.pause();video.srcObject=null;id=crypto.randomUUID();
 note('Waiting for your Studio game… Keep Studio open and start the game output.');
 try{
  const current=new RTCPeerConnection({iceServers:[]});peer=current;
  const geometry=current.createDataChannel('viewport');geometry.onmessage=e=>{try{const data=JSON.parse(e.data),g=data.game;if(data.type!=='viewport'||![data.width,data.height,g?.x,g?.y,g?.width,g?.height].every(Number.isFinite)||data.width<=0||data.height<=0||g.width<=0||g.height<=0||Math.max(data.width,data.height)>10000)return;viewport=data;fit();}catch{}};
  current.addTransceiver('video',{direction:'recvonly'});current.addTransceiver('audio',{direction:'recvonly'});
  current.ontrack=e=>{if(current!==peer)return;const media=video.srcObject||new MediaStream();media.addTrack(e.track);video.srcObject=media;video.play().then(()=>{status.hidden=true;}).catch(()=>{video.muted=true;video.play().then(()=>{status.hidden=true;}).catch(()=>note('Allow video playback in your browser source.'));});};
  current.onconnectionstatechange=()=>{if(current!==peer||stopped)return;if(['failed','disconnected','closed'].includes(current.connectionState)){note('Studio game output disconnected. Reconnecting…');clearTimeout(timer);timer=setTimeout(connect,2000);}};
  await current.setLocalDescription(await current.createOffer());await gatherICE(current);
  if(stopped||current!==peer)return;
  await signals.send({type:'offer',id,sdp:current.localDescription.sdp});
  timer=setTimeout(()=>{if(current===peer&&current.connectionState!=='connected')void connect();},15000);
 }catch{note('Game connection unavailable. Check that Studio and this source are on the same computer or local network.');timer=setTimeout(connect,5000);}finally{retrying=false;}
}
async function receive(message){if(message.type!=='answer'||message.id!==id||typeof message.sdp!=='string'||message.sdp.length>24000||peer?.signalingState!=='have-local-offer')return;await peer.setRemoteDescription({type:'answer',sdp:message.sdp});}
try{identity=parseOutputLink(location.hash);signals=await connectOutputSignals(identity,receive);await connect();}catch{note('Invalid or unavailable game output. Copy the complete game link from Studio.');}
video.addEventListener('playing',()=>{status.hidden=true;});
window.addEventListener('pagehide',()=>{stopped=true;clearTimeout(timer);peer?.close();void signals?.close();video.srcObject=null;});
