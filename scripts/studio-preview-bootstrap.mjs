import {installQAAuth} from './qa-auth-fixture.mjs';
// This fixture is injected only by a loopback-only test server, never by the app.
export function studioFixtureBootstrap(user,runId,{preview=false}={}){
 const auth=preview?installQAAuth.toString().replace("display_name:'Layout test'","display_name:'Creator Preview',tiktok_username:'creator.preview'"):installQAAuth.toString();
 return '('+auth+')(true);'+`
 if(localStorage.getItem('qa-workspace-run')!=='${runId}'){for(const key of Object.keys(localStorage))if(key.startsWith('tikinteract_layout_'))localStorage.removeItem(key);localStorage.setItem('qa-workspace-run','${runId}');localStorage.setItem('qa-user','${user.id}');}
 const c=window.supabase.createClient(),rpc=c.rpc.bind(c),session=c.auth.getSession.bind(c.auth),on=c.auth.onAuthStateChange.bind(c.auth);
 const uid=()=>localStorage.getItem('qa-user')||'${user.id}',fix=s=>{if(s?.user)s.user.id=uid();return s;};
 c.auth.getSession=async()=>{const r=await session();fix(r.data.session);return r;};c.auth.onAuthStateChange=fn=>on((e,s)=>fn(e,fix(s)));c.auth.getUser=async()=>({data:{user:{id:uid(),email:'fixture@example.invalid'}},error:null});
 c.rpc=async(n,a={})=>n.startsWith('studio_layout_')?fetch('/__layout',{method:'POST',body:JSON.stringify({name:n,args:a,user:uid()})}).then(r=>r.json()):n==='get_my_account_status'?{data:{allowed:true,state:'active'},error:null}:n==='get_my_access'?{data:{plan:'free',periods:[],serverNow:new Date().toISOString()},error:null}:rpc(n,a);
 const original=window.fetch.bind(window);window.fetch=(u,o={})=>window.__qaOffline&&String(u).includes('/api/animations')?Promise.resolve(Response.json({error:'ANIM_SETUP_REQUIRED'},{status:503})):String(u).includes('/rpc/get_site_public_config')?Promise.resolve(Response.json({})):original(u,String(u).includes('/api/animations')?{...o,headers:{...o.headers,'X-QA-User':uid()}}:o);
 ${preview?`document.addEventListener('DOMContentLoaded',()=>{const notice=document.createElement('div');notice.setAttribute('data-native-i18n','');notice.textContent='PREVIZUALIZARE LOCALĂ · DATE DE TEST · FĂRĂ PLĂȚI SAU AI REAL';notice.style.cssText='position:fixed;bottom:9px;right:12px;z-index:99999;pointer-events:none;padding:6px 10px;border:1px solid #ffffff22;border-radius:7px;background:#101724ec;color:#b8c8df;font:9px/1.4 system-ui;letter-spacing:.04em;max-width:calc(100vw - 90px)';document.body.append(notice);});`:''}
 `;
}
