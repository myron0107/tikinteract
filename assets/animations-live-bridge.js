import {animationAPI} from './animations-client.js?v=2';
import {matchesAnimationRule} from './animations-live-rules.js?v=1';
// Reuse the existing authenticated local normalizer. Vercel never connects to
// localhost. Only matching events are sent, in bounded batches.
let owner,epoch=0,rules=[],pending=[],sending=false;const seen=new Set();
async function refresh(){const own=window.tikInteractUser?.id,version=epoch;if(!own)return;try{const data=await animationAPI({action:'eventConfig'});if(version===epoch&&own===window.tikInteractUser?.id)rules=data.rules;}catch{if(version===epoch)rules=[];}}
window.addEventListener('tikinteract:auth',()=>{if(owner!==window.tikInteractUser?.id){owner=window.tikInteractUser?.id;epoch++;seen.clear();rules=[];pending=[];refresh();}});
window.addEventListener('tikinteract:animation-rules-changed',refresh);
window.addEventListener('tikinteract:live-event',event=>{
 const e=event.detail;if(!window.tikInteractUser||e?.type!=='gift'||e.demo===true||!e.eventId||seen.has(e.eventId)||!rules.some(r=>matchesAnimationRule(r,e)))return;
 seen.add(e.eventId);if(seen.size>1000)seen.delete(seen.values().next().value);
 if(pending.length<20)pending.push({type:'gift',eventId:e.eventId,timestamp:e.timestamp,username:e.username,giftId:e.giftId,giftName:e.giftName,repeatCount:e.repeatCount,coins:e.coins});
});
setInterval(async()=>{if(sending||!pending.length||!window.tikInteractUser)return;sending=true;const events=pending.splice(0,20);try{await animationAPI({action:'eventBatch',events});}catch{window.dispatchEvent(new CustomEvent('tikinteract:animation-event-error'));}finally{sending=false;}},2000);
setInterval(()=>{if(!document.hidden)refresh();},60000);refresh();
