// One ticket component for the public homepage and the authenticated subscription screen.
import {esc,ic} from './creator-ui.js?v=2';
import {offerPlans,offerSummary} from './commerce-offers.js?v=1';
export const passText=(ro,en)=>window.TikInteractLanguage?.get()==='en'?en:ro;
export const planLabel=plan=>plan.id==='free'?passText('GRATUIT','FREE'):plan.name;
export function planTickets(plans,{studio=false,access=null,selected=''}={}){
 return '<div class="ti-ticket-grid">'+offerPlans(plans).filter(plan=>plan.enabled).map(plan=>{
  const active=studio&&access?.plan===plan.id,included=studio&&plan.id==='free'&&access?.plan&&access.plan!=='free';
  const button=active?passText('Planul tău','Your plan'):included?passText('Acces de bază inclus','Basic access included'):plan.id==='free'?passText('Începe gratuit','Start for free'):studio?passText('Vezi opțiunile','View options'):passText('Vezi detalii','View details');
  const price=new Intl.NumberFormat(window.TikInteractLanguage?.locale()||'ro-RO',{maximumFractionDigits:2}).format(plan.priceCents/100);
  return '<article class="ti-ticket" data-ticket-plan="'+esc(plan.id)+'"'+(selected===plan.id?' data-selected="true"':'')+'><div class="ti-ticket-heading"><h3>'+esc(planLabel(plan))+'</h3>'+ic('ticket')+'</div>'+(active?'<span class="ti-ticket-active">'+passText('PLAN ACTIV','ACTIVE PLAN')+'</span>':'')+'<div class="ti-ticket-price"><strong>'+price+'</strong><span>'+esc(plan.currency)+(plan.id==='free'?'':passText(' / lună',' / month'))+'</span></div><ul>'+plan.features.slice(0,3).map(feature=>'<li>'+ic('check')+'<span>'+esc(window.TikInteractLanguage?.translate(feature)||feature)+'</span></li>').join('')+'</ul><button type="button" data-ticket-action="'+esc(plan.id)+'"'+(active||included?' disabled':'')+'>'+button+(active||included?'':ic('arrow-right'))+'</button><div class="ti-ticket-barcode" aria-hidden="true"></div></article>';
 }).join('')+'</div>'+offerSummary();
}
