import {renderAIGenerator} from './ai-generator-view.js?v=1';
import {esc,ic} from './creator-ui.js?v=4';
import {animationText as t} from './animations-client.js?v=2';

const plan=()=>({free:'FREE',play_pass:'PLAY PASS',play_pass_pro:'PLAY PASS PRO'})[window.TikInteractPass?.getAccess()?.plan]||'—';
export function aiCredits(s){
 return `<section class="an-panel an-info ai-credit-card"><header><h3>${t('Creditele mele','My credits')}</h3><span class="an-badge">${t('SOLD COMUN','SHARED BALANCE')}</span></header><div class="ai-balance"><small>${t('Disponibile în cont','Available in account')} · ${plan()}</small><strong>${Number(s.wallet.included)+Number(s.wallet.purchased)} <span>${t('credite','credits')}</span></strong>${ic('gem')}</div><dl><div><dt>${t('Plan activ','Active plan')}</dt><dd>${plan()}</dd></div><div><dt>Standard AI · 5 s</dt><dd>${s.config.standardCredits??'—'} ${t('credite','credits')}</dd></div><div><dt>Premium AI · 5 s</dt><dd>${s.config.premiumCredits??'—'} ${t('credite','credits')}</dd></div><div><dt>${t('Incluse / cumpărate','Included / purchased')}</dt><dd>${s.wallet.included} / ${s.wallet.purchased}</dd></div></dl>${s.wallet.debt?`<p>${t('De regularizat','To reconcile')}: ${s.wallet.debt}</p>`:''}<button type="button" class="an-button an-primary" data-an-action="topup">${ic('plus')}${t('Reîncarcă credite','Top up credits')}</button><p>${t('Fără abonament obligatoriu. FREE nu primește credite gratuite, dar poate cumpăra credite AI.','No subscription required. FREE does not receive free credits but can purchase AI credits.')}</p></section>`;
}
export function generator(s){return renderAIGenerator(s,aiCredits);}
export function guide(){
 return `<div class="ai-guide-grid">${[
 ['user-plus',t('1. Pregătește personajul','1. Prepare your character'),t('Încarcă o fotografie clară și confirmă acordul persoanei. Fotografia rămâne privată în cont.','Upload a clear photo and confirm consent. The photo stays private in your account.')],
 ['layer-group',t('2. Alege universul','2. Choose a universe'),t('Selectează un stil și descrie acțiunea. Alege Standard sau Premium și formatul 9:16 ori 16:9.','Select a style and describe the action. Choose Standard or Premium and a 9:16 or 16:9 format.')],
 ['gem',t('3. Verifică creditele','3. Check your credits'),t('Costul este afișat înainte de generare. Creditele sunt rezervate, iar cererea este verificată înainte de procesare.','The cost is shown before generation. Credits are reserved and the request is reviewed before processing.')],
 ['film',t('4. Folosește animația în LIVE','4. Use the animation in LIVE'),t('Rezultatul se salvează în Biblioteca mea. În LIVE Studio → Animații îl poți reda, adăuga la favorite sau asocia unui eveniment.','The result is saved in My library. In LIVE Studio → Animations you can play it, favorite it or connect it to an event.')]
 ].map(([icon,title,text])=>`<section class="an-panel an-info">${ic(icon)}<h2>${title}</h2><p>${text}</p></section>`).join('')}</div><div class="an-actions ai-guide-actions"><button type="button" class="an-button" data-an-open-tab="generator">${t('Deschide Generator AI','Open AI generator')}</button><button type="button" class="an-button" data-an-open-tab="history">${t('Istoric generări','Generation history')}</button></div>`;
}
