import{rpc}from'./creator-ui.js?v=1';
let session=null,user=null,chats=0,likes=0,peak=null,people=new Set(),seen=new Set(),flight=null,disabled=false;
function reset(){session=null;user=null;chats=likes=0;peak=null;people.clear();seen.clear();disabled=false;}
async function flush(){if(flight){await flight;return flush();}if(!session||disabled||user!==window.tikInteractUser?.id)return;const id=session,owner=user;
 flight=(async()=>{do{const batch=[...people].slice(0,200);try{await rpc('record_my_live_metrics',{p_session:id,p_chat:chats,p_likes:likes,p_peak:peak,p_people:batch});if(id!==session||owner!==user)return;batch.forEach(name=>people.delete(name));}catch(e){if(id===session&&/PGRST202|does not exist|schema cache/.test((e?.code||'')+' '+(e?.message||'')))disabled=true;return;}}while(people.size&&id===session&&owner===user);})();
 try{await flight;}finally{flight=null;}}
window.addEventListener('tikinteract:session-started',event=>{reset();session=event.detail.session;user=event.detail.user;flush();});
window.addEventListener('tikinteract:live-event',event=>{const m=event.detail;if(!session||user!==window.tikInteractUser?.id)return;if(m.type==='audience'){const count=Number(m.viewerCount);if(Number.isSafeInteger(count)&&count>=0&&count<=10000000)peak=Math.max(peak||0,count);return;}
 if(!['chat','like'].includes(m.type))return;const id=m.eventId||m.messageId;if(id&&seen.has(id))return;if(id){seen.add(id);if(seen.size>20000)seen.delete(seen.values().next().value);}if(m.type==='chat'){chats=Math.min(1000000000,chats+1);if(m.username&&people.size<5000)people.add(String(m.username).slice(0,80));}else{const count=Number(m.likeCount);if(Number.isSafeInteger(count)&&count>0)likes=Math.min(1000000000,likes+count);}});
window.addEventListener('tikinteract:session-ending',flush);
window.addEventListener('tikinteract:auth',()=>{if(user!==window.tikInteractUser?.id)reset();});
document.addEventListener('visibilitychange',()=>{if(document.hidden)flush();});
// OBS or another window may be in front while the stream is still running.
setInterval(flush,15000);
window.TikInteractMetrics=Object.freeze({flush,clear:reset});
