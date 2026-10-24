import {stop as stopSceneAnimation} from './studio-animation-player.js?v=1';
import {animationText as t} from './animations-client.js?v=2';
let pending;
function unloadGame(){
 const frame=document.getElementById('live-game-frame');if(!frame)return;
 // Stop the game document/audio, leaving the independent OBS output alive.
 window.dispatchEvent(new Event('tikinteract:game-closed'));stopSceneAnimation();window.TikInteractLive?.detach();
 frame.onload=null;delete frame.dataset.gameId;frame.removeAttribute('src');frame.removeAttribute('aria-busy');frame.hidden=true;
 document.querySelector('.live-game-frame-wrap')?.classList.add('is-empty');
 const empty=document.getElementById('studio-game-empty');if(empty)empty.hidden=false;
 const select=document.getElementById('live-game-select');if(select)select.value='';
 document.querySelectorAll('[data-live-game]').forEach(b=>{b.classList.remove('is-active');b.setAttribute('aria-pressed','false');});
 window.resetStudioTestMenu?.();document.getElementById('studio-test-panel')?.setAttribute('aria-busy','false');
 const name=document.getElementById('studio-test-game-name');if(name)name.textContent=t('Alege un joc.','Choose a game.');
 const status=document.getElementById('live-game-status');if(status)status.textContent=t('Jocul a fost închis. Poți alege alt joc.','Game closed. You can choose another game.');
 const test=document.querySelector('.studio-test-status');if(test)test.hidden=true;
 window.updateCurrentLiveGame?.(null);
}
export function requestCloseStudioGame(){
 if(!document.getElementById('live-game-frame')?.dataset.gameId)return Promise.resolve(true);
 if(pending)return pending;
 pending=new Promise(resolve=>{
  const dialog=document.createElement('dialog');dialog.className='an-dialog studio-game-close-dialog';dialog.dataset.nativeI18n='';dialog.setAttribute('aria-labelledby','game-close-title');
  dialog.innerHTML=`<div class="an-dialog-body"><h2 id="game-close-title">${t('Închizi jocul?','Close game?')}</h2><p>${t('Ești sigur că vrei să închizi jocul curent?','Are you sure you want to close the current game?')}</p><p>${t('Linkul OBS rămâne același pentru următorul joc.','The OBS link stays the same for the next game.')}</p><div class="an-actions"><button type="button" class="an-button" data-game-close-no>${t('Nu','No')}</button><button type="button" class="an-button an-primary" data-game-close-yes>${t('Da, închide jocul','Yes, close game')}</button></div></div>`;
  let confirmed=false;document.body.append(dialog);
  dialog.querySelector('[data-game-close-no]').onclick=()=>dialog.close();
  dialog.querySelector('[data-game-close-yes]').onclick=()=>{unloadGame();confirmed=true;dialog.close();};
  dialog.addEventListener('click',e=>{if(e.target===dialog)dialog.close();});
  dialog.addEventListener('close',()=>{dialog.remove();pending=null;resolve(confirmed);},{once:true});dialog.showModal();dialog.querySelector('[data-game-close-no]').focus({preventScroll:true});
 });return pending;
}
