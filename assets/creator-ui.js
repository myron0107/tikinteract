import{ct}from'./creator-copy.js?v=1';
export{ct};
export const esc=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
export const ic=name=>`<i class="fa-solid fa-${name}" aria-hidden="true"></i>`;
export const locale=()=>window.TikInteractLanguage?.locale()||'ro-RO';
export const number=value=>new Intl.NumberFormat(locale(),{maximumFractionDigits:0}).format(Number(value)||0);
export const date=value=>value?new Date(value).toLocaleString(locale(),{day:'2-digit',month:'short',year:'numeric',hour:'2-digit',minute:'2-digit'}):'—';
export const duration=value=>{const seconds=Math.max(0,Math.floor(Number(value)||0)),m=Math.floor(seconds/60);return seconds<60?seconds+'s':Math.floor(m/60)+'h '+m%60+'m';};
export function gameName(id){return id==='unselected'?ct('unselected'):window.TikInteractPlatform?.getGame(id)?.name||({'neon-race-2':'NEON INTERACT','moto-interact':'MOTO INTERACT','nova-vex':'NOVA & VEX'}[id])||ct('unknownGame');}
export async function rpc(name,args={}){const client=window.tikInteractSupabase;if(!client)throw Error('CLIENT_UNAVAILABLE');const{data,error}=await client.rpc(name,args);if(error)throw error;return data;}
export function errorCopy(error){const m=error?.message||'';return /PGRST202|schema cache|does not exist/.test((error?.code||'')+' '+m)?ct('setupPending'):/COMMUNITY_RATE_LIMIT/.test(m)?ct('rateLimit'):/COMMUNITY_PEER_UNAVAILABLE/.test(m)?ct('peerUnavailable'):ct('unavailable');}
export const avatar=(name,url='')=>`<span class="cp-avatar" translate="no">${esc((name||'T').slice(0,1).toUpperCase())}${/^https:\/\//.test(url)?`<img src="${esc(url)}" alt="" referrerpolicy="no-referrer" onerror="this.remove()">`:''}</span>`;
export const empty=(title,copy,icon='inbox')=>`<div class="cp-empty">${ic(icon)}<h3>${esc(title)}</h3>${copy?`<p>${esc(copy)}</p>`:''}</div>`;
export function downloadCSV(filename,rows){const data='\uFEFF'+rows.map(row=>row.map(value=>{let text=String(value??'');if(typeof value==='string'&&/^[\s]*[=+@\-\t\r]/.test(text))text="'"+text;return'"'+text.replace(/"/g,'""')+'"';}).join(',')).join('\r\n');const url=URL.createObjectURL(new Blob([data],{type:'text/csv;charset=utf-8'})),a=document.createElement('a');a.href=url;a.download=filename;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);}
