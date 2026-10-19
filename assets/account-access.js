// The database makes the decision. This module closes the workspace and explains it to the user.
let identity=null,state=null,request=0,notice,lastRestriction,signingOut=false;
const date=value=>new Date(value).toLocaleString('ro-RO',{day:'2-digit',month:'long',year:'numeric',hour:'2-digit',minute:'2-digit'});
const isAllowed=()=>!!window.tikInteractUser&&identity===window.tikInteractUser.id&&state?.allowed===true;
function showNotice(reason=lastRestriction||state){
 if(!notice){notice=document.createElement('dialog');notice.className='account-access-notice';notice.setAttribute('aria-labelledby','account-notice-title');notice.innerHTML='<header><span><i class="fa-solid fa-user-shield" aria-hidden="true"></i> CONTUL TĂU</span><button type="button" aria-label="Închide">×</button></header><h2 id="account-notice-title"></h2><p></p><div><a href="mailto:mironsergiuflorin@gmail.com">Contactează-ne</a><button type="button" data-account-notice-close>Am înțeles</button></div>';document.body.append(notice);notice.querySelector('header button').onclick=()=>notice.close();notice.querySelector('[data-account-notice-close]').onclick=()=>notice.close();}
 let title='Verificarea contului',copy='Așteaptă verificarea accesului și încearcă din nou.';
 if(reason?.state==='suspended'){title='Acces suspendat temporar';copy='Accesul la platformă este suspendat'+(reason.until?' până la '+date(reason.until):'')+'. Datele contului se păstrează. Pentru întrebări, contactează echipa.';}
 else if(reason?.state==='banned'){title='Acces restricționat';copy='Acest cont are o interdicție de acces pe platformă. Pentru întrebări, contactează echipa.';}
 else if(reason?.state==='unavailable'){title='Cont indisponibil';copy='Acest cont nu mai poate fi folosit. Intră cu un cont activ sau contactează echipa.';}
 else if(reason?.state==='error'){title='Nu am putut verifica accesul';copy='Verifică legătura la internet și încearcă din nou. Studioul devine disponibil după confirmarea accesului.';}
 notice.querySelector('h2').textContent=title;notice.querySelector('p').textContent=copy;if(!notice.open)notice.showModal();
}
function render(){
 const user=window.tikInteractUser,blocked=!!user&&!isAllowed();document.body.classList.toggle('account-access-locked',blocked);
 const gate=document.getElementById('studio-access-gate');if(gate){gate.hidden=!!user&&isAllowed();const title=document.getElementById('studio-access-title');if(title&&user&&!isAllowed())title.textContent=state?.state==='error'?'Verificarea contului nu este disponibilă':'Verificăm accesul la Studio…';const login=document.getElementById('studio-access-login');if(login)login.hidden=!!user;let retry=gate.querySelector('[data-account-retry]');if(!retry){retry=document.createElement('button');retry.type='button';retry.dataset.accountRetry='';retry.textContent='Verifică din nou';retry.onclick=refresh;gate.querySelector('div')?.append(retry);}retry.hidden=!user||state?.state!=='error';}
 window.dispatchEvent(new Event('tikinteract:account-status'));
}
async function rejectAccount(status){
 lastRestriction=status;window.stopTikInteractStudio?.();window.updateUI?.(null);if(document.body.dataset.page!=='studio')window.switchView?.('home');showNotice(status);
 const client=window.tikInteractSupabase;if(client&&!signingOut){signingOut=true;try{await client.auth.signOut({scope:'local'});}finally{signingOut=false;}}
}
async function refresh(){
 const client=window.tikInteractSupabase,id=window.tikInteractUser?.id,current=++request;
 if(!id||!client){identity=null;state=null;render();return null;}
 if(identity!==id){identity=id;state=null;render();}
 try{const {data,error}=await client.rpc('get_my_account_status');if(current!==request||id!==window.tikInteractUser?.id)return null;if(error)throw error;
  if(!data||typeof data.allowed!=='boolean')throw Error('Account status unavailable');state=data;render();
  if(!data.allowed)await rejectAccount(data);else{lastRestriction=null;if(notice?.open)notice.close();if(document.body.dataset.page==='studio')window.startTikInteractStudio?.();}return data;
 }catch(error){if(current!==request||id!==window.tikInteractUser?.id)return null;state={allowed:false,state:'error'};window.stopTikInteractStudio?.();render();return null;}
}
window.TikInteractAccount=Object.freeze({isAllowed,refresh,showNotice,getStatus:()=>state?JSON.parse(JSON.stringify(state)):null});
window.addEventListener('tikinteract:auth',()=>{const id=window.tikInteractUser?.id;if(identity!==id){request++;identity=null;state=null;}refresh();});
window.addEventListener('visibilitychange',()=>{if(!document.hidden&&window.tikInteractUser)refresh();});
setInterval(()=>{if(!document.hidden&&window.tikInteractUser)refresh();},20000);
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',refresh,{once:true});else refresh();
