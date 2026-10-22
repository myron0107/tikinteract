// A lease check complements the server gate for pages that were already open.
let request,busy=false,hasLease=false,lastCheck=0,closing=false;
const ownUser=()=>window.tikInteractUser;
function stop(){window.stopTikInteractStudio?.();document.querySelectorAll('iframe').forEach(frame=>frame.removeAttribute('src'));}
async function closePreview(){
 if(closing)return;closing=true;stop();
 try{if(ownUser()?.app_metadata?.site_preview)await window.tikInteractSupabase?.auth.signOut({scope:'local'});}catch{}
 location.replace('/maintenance.html?next='+encodeURIComponent(location.pathname+location.search));
}
async function check(){
 if(closing||busy||document.hidden||Date.now()-lastCheck<2000)return;busy=true;lastCheck=Date.now();
 try{
  const response=await fetch('/api/maintenance?action=status',{cache:'no-store',credentials:'same-origin',signal:AbortSignal.timeout(8000)});
  // Static preview servers have no API; production/server failures are handled below.
  if(response.status===404)return;
  if(!response.ok)throw Error('LEASE_UNAVAILABLE');const data=await response.json();
  if(!data.allowed||(hasLease&&data.kind==='guest'&&!data.valid)||(ownUser()?.app_metadata?.site_preview&&!data.valid)){await closePreview();return;}
  hasLease=data.valid;
 }catch{if(hasLease||ownUser()?.app_metadata?.site_preview)await closePreview();}
 finally{busy=false;}
}
window.addEventListener('tikinteract:auth',()=>{
 if(closing)return;
 if(!ownUser()&&hasLease){closing=true;stop();fetch('/api/maintenance',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({action:'logout'}),keepalive:true}).catch(()=>{}).finally(()=>location.replace('/maintenance.html'));}
 else check();
});
document.addEventListener('visibilitychange',()=>{if(!document.hidden)check();});
window.addEventListener('pagehide',()=>clearInterval(request));
window.addEventListener('pageshow',event=>{if(event.persisted){lastCheck=0;clearInterval(request);request=setInterval(check,15000);check();}});
request=setInterval(check,15000);check();
