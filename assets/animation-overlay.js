// Capability lives in the fragment, never in server/CDN request logs.
const token=location.hash.slice(1),video=document.getElementById('animation');
let current=null,busy=false,ack=null,delay=2000;
async function poll(){
 if(busy||current)return;busy=true;
 try{
  const r=await fetch('/api/animations/overlay',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({token,...ack}),cache:'no-store',signal:AbortSignal.timeout(10000)});
  if(!r.ok){delay=r.status===401?30000:5000;return;}
  delay=2000;const data=await r.json();ack=null;if(data.clip){current=data.clip;video.src=current.url;video.dataset.playing='';await video.play();}
 }catch{if(current)finish(true);delay=5000;}finally{busy=false;}
}
function finish(error=false){if(!current)return;ack={ack:current.id,lease:current.lease,error};current=null;video.pause();video.removeAttribute('data-playing');video.removeAttribute('src');video.load();poll();}
video.addEventListener('ended',()=>finish());video.addEventListener('error',()=>finish(true));
async function loop(){await poll();setTimeout(loop,delay);}loop();
