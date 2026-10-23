import {animationAPI} from './animations-client.js?v=2';
let cache=null,stamp=0,pending=null,epoch=0;
export async function loadAnimationState({force=false}={}){
 const user=window.tikInteractUser?.id;if(!user)throw Error('ANIM_LOGIN_REQUIRED');
 if(!force&&cache?.user===user&&Date.now()-stamp<5000)return cache.data;
 if(pending?.user===user)return pending.promise;
 const current=epoch,promise=animationAPI({action:'state'}).then(data=>{
  if(current!==epoch||user!==window.tikInteractUser?.id)throw Error('ANIM_ACCOUNT_CHANGED');
  cache={user,data};stamp=Date.now();window.dispatchEvent(new CustomEvent('tikinteract:animation-state',{detail:data}));return data;
 }).catch(error=>{if(current===epoch&&user===window.tikInteractUser?.id){cache=null;stamp=0;window.dispatchEvent(new CustomEvent('tikinteract:animation-error'));}throw error;}).finally(()=>{if(pending?.promise===promise)pending=null;});pending={user,promise};return promise;
}
window.addEventListener('tikinteract:auth',()=>{epoch++;cache=null;stamp=0;pending=null;});
