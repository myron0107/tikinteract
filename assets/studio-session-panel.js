import {createStudioSession} from './studio-session-model.js?v=1';
import {esc,ic} from './creator-ui.js?v=4';
const session=createStudioSession(),t=(ro,en)=>window.TikInteractLanguage?.get()==='en'?en:ro;
let root,tab='chat',inspector='game',frame=0,owner=null;
const number=value=>value===null?'—':new Intl.NumberFormat(t('ro-RO','en-GB')).format(value);
function paint(){
 if(!root)return;const s=session.snapshot();
 document.documentElement.dataset.studioInspector=inspector;
 for(const button of document.querySelectorAll('.studio-inspector-switch button[data-studio-inspector]')){button.setAttribute('aria-pressed',String(button.dataset.studioInspector===inspector));button.querySelector('span').textContent=button.dataset.studioInspector==='game'?t('Control joc','Game controls'):t('Publicul tău','Your audience');}
 const labels={chat:t('Chat LIVE','LIVE chat'),gifts:t('Cadouri','Gifts'),top:t('Susținători','Supporters')};
 root.innerHTML=`<div class="studio-session-metrics"><div>${ic('users')}<strong>${number(s.viewers)}</strong><span>${t('Spectatori','Viewers')}</span></div><div>${ic('heart')}<strong>${number(s.likes)}</strong><span>Likes</span></div><div>${ic('gift')}<strong>${number(s.coins)}</strong><span>${t('Monede LIVE','LIVE coins')}</span></div></div><div class="studio-session-tabs" role="group" aria-label="${t('Activitate LIVE','LIVE activity')}">${Object.entries(labels).map(([id,label])=>`<button type="button" data-session-tab="${id}" aria-pressed="${id===tab}">${label}${id==='chat'?`<small>${s.comments}</small>`:''}</button>`).join('')}</div><div class="studio-session-content" aria-live="polite" aria-relevant="additions text">${tab==='chat'?s.chat.map(row=>`<article class="studio-chat-row"><span class="studio-chat-avatar">${esc(row.username[0]?.toUpperCase()||'?')}</span><div><strong translate="no">@${esc(row.username)}</strong><p translate="no">${esc(row.text)}</p></div></article>`).join(''):tab==='gifts'?s.recentGifts.map(row=>`<article class="studio-gift-row">${ic('gift')}<div><strong translate="no">@${esc(row.username)}</strong><p>${esc(row.gift)} × ${row.quantity}</p></div><span>${number(row.coins)}</span></article>`).join(''):s.supporters.slice(0,10).map((p,index)=>`<article class="studio-supporter-row"><small>${String(index+1).padStart(2,'0')}</small><strong translate="no">@${esc(p.username)}</strong><span>${number(p.coins)}</span></article>`).join('')||''}</div><footer class="studio-session-footer">${ic(s.connected?'tower-broadcast':'plug')}<span>${s.connected?t('Date din sesiunea LIVE curentă','Current LIVE session data'):t('Conectează TikTok LIVE pentru activitate în timp real.','Connect TikTok LIVE for real-time activity.')}</span></footer>`;
 const content=root.querySelector('.studio-session-content');if(!content.children.length)content.innerHTML=`<div class="studio-session-empty">${ic(tab==='chat'?'comments':tab==='gifts'?'gift':'users')}<strong>${s.connected?t('Așteptăm primul moment.','Waiting for the first moment.'):t('Publicul tău va apărea aici.','Your audience will appear here.')}</strong><p>${t('Mesaje, cadouri și susținători, în același loc.','Messages, gifts and supporters, in one place.')}</p></div>`;
 window.dispatchEvent(new Event('tikinteract:session-summary'));
}
function schedule(){if(frame)return;frame=requestAnimationFrame(()=>{frame=0;paint();});}
function init(){
 const controls=document.querySelector('.studio-controls');if(!controls)return;
 const switcher=controls.querySelector('.studio-inspector-switch');root=document.getElementById('studio-live-session');if(!switcher||!root)return;owner=window.tikInteractUser?.id||null;
 window.TikInteractStudioSession=Object.freeze({get:session.snapshot});
 switcher.addEventListener('click',e=>{const b=e.target.closest('[data-studio-inspector]');if(b){inspector=b.dataset.studioInspector;paint();}});
 root.addEventListener('click',e=>{const b=e.target.closest('[data-session-tab]');if(b){tab=b.dataset.sessionTab;paint();}});
 window.addEventListener('tikinteract:live-event',e=>{if(session.receive(e.detail))schedule();});
 window.addEventListener('tikinteract:auth',()=>{const next=window.tikInteractUser?.id||null;if(next!==owner){owner=next;session.reset();schedule();}});window.addEventListener('tikinteract:language',paint);paint();
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init,{once:true});else init();
