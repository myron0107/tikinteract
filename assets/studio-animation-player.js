import {animationAPI,animationError,animationText as t} from './animations-client.js?v=2';
let root,video,stopButton,status,current=null,epoch=0,owner=window.tikInteractUser?.id,queue=[],controller,timer;
const seen=new Set();
function emit(state,extra={}){const detail={state,id:current?.id,title:current?.title,queued:queue.length,...extra};window.dispatchEvent(new CustomEvent('tikinteract:scene-animation',{detail}));if(status)status.textContent=detail.message||'';if(stopButton)stopButton.hidden=!current&&!queue.length;}
function mount(){
 const wrap=document.querySelector('.live-game-frame-wrap');if(!wrap)throw Error('ANIM_SCENE_UNAVAILABLE');
 const host=document.getElementById('studio-game-output-target')||wrap;
 if(root){if(root.parentElement!==host){if(host.moveBefore)host.moveBefore(root,null);else host.append(root);}return;}
 root=document.createElement('div');root.className='studio-scene-animation-layer';root.hidden=true;root.dataset.sceneAnimation='';
 video=document.createElement('video');video.playsInline=true;video.preload='auto';video.setAttribute('aria-label',t('Animație peste joc','Animation over the game'));root.append(video);host.append(root);
 status=document.createElement('p');status.className='studio-scene-animation-status';status.setAttribute('role','status');status.setAttribute('aria-live','polite');wrap.after(status);
 stopButton=document.createElement('button');stopButton.type='button';stopButton.className='an-button studio-scene-animation-stop';stopButton.hidden=true;stopButton.textContent=t('Oprește animația','Stop animation');stopButton.onclick=stop;
 (document.querySelector('.studio-stage-heading')||wrap.parentElement).append(stopButton);
 video.addEventListener('ended',()=>finish());video.addEventListener('error',()=>{if(current)finish('ANIM_PLAYBACK_FAILED');});
}
function clearVideo(){if(!video)return;video.pause();root.hidden=true;video.removeAttribute('src');video.load();}
function finish(error){if(!current)return;const id=current.id;current=null;clearTimeout(timer);clearVideo();emit(error?'error':'ended',{id,message:error?t('Videoclipul nu a putut fi redat. Verifică fișierul din bibliotecă.','The video could not play. Check the file in your library.'):''});if(queue.length)void start().catch(()=>{});}
export function stop(){epoch++;controller?.abort();clearTimeout(timer);current=null;queue=[];clearVideo();emit('stopped');}
async function start(){
 const job=queue.shift();if(!job)return{state:'idle'};current=job;const version=epoch;
 const requestController=new AbortController();controller=requestController;timer=setTimeout(()=>requestController.abort(),30000);
 try{
  mount();emit('loading',{message:t('Se încarcă animația…','Loading animation…')});
  const clip=await animationAPI({action:'playback',id:job.id},{signal:requestController.signal});
  if(version!==epoch||current!==job||job.owner!==window.tikInteractUser?.id)return{state:'cancelled'};
  const url=new URL(clip.url,location.origin);if(url.protocol!=='https:'&&url.origin!==location.origin)throw Error('ANIM_INVALID_MEDIA');
  current.title=clip.title;video.muted=false;video.src=url.href;root.hidden=false;
  try{await video.play();}catch(error){if(error.name!=='NotAllowedError')throw error;video.muted=true;await video.play();}
  if(version!==epoch||current!==job)return{state:'cancelled'};clearTimeout(timer);
  emit('playing',{muted:video.muted,message:t('Se redă peste joc: ','Playing over game: ')+clip.title+(video.muted?t(' · fără sunet',' · muted'):'')});return{state:'playing'};
 }catch(error){if(version===epoch&&current===job){finish(error.message);throw error;}return{state:'cancelled'};}
}
export async function playSceneAnimation(id,{eventKey,reveal=true}={}){
 const user=window.tikInteractUser?.id;if(!user)throw Error('ANIM_LOGIN_REQUIRED');
 if(eventKey&&seen.has(eventKey))return{state:'duplicate'};
 if(queue.length>=20)throw Error('ANIM_QUEUE_FULL');
 if(reveal){if(window.TikInteractWidgetDesktop?.getActive()!=='studio')window.TikInteractWidgetDesktop?.open('studio');await window.TikInteractWidgetDesktop?.choose('preview',true);}
 if(user!==window.tikInteractUser?.id)throw Error('ANIM_ACCOUNT_CHANGED');
 if(eventKey){seen.add(eventKey);if(seen.size>1000)seen.delete(seen.values().next().value);}
 queue.push({id,owner:user});if(current){emit('queued',{message:t('Animație adăugată după cea curentă.','Animation queued after the current one.')});return{state:'queued'};}
 return start();
}
// Local scene playback never consumes the private OBS/TikTok Link queue.
export async function triggerAnimation(id){
 const scene=playSceneAnimation(id),overlay=animationAPI({action:'event',manual:true,clip:id,requestId:crypto.randomUUID()},{signal:AbortSignal.timeout(15000)});
 const [local,external]=await Promise.allSettled([scene,overlay]);
 if(local.status==='rejected')throw local.reason;
 if(local.value.state==='cancelled')throw Error('ANIM_ACCOUNT_CHANGED');
 return{...local.value,overlayQueued:external.status==='fulfilled'&&external.value.queued>0,overlayError:external.status==='rejected'?animationError(external.reason.message):null};
}
window.addEventListener('tikinteract:auth',()=>{const next=window.tikInteractUser?.id;if(owner!==next){owner=next;stop();seen.clear();}});
window.addEventListener('pagehide',stop);
