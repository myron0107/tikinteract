export async function animationAPI(body,{signal,client=window.tikInteractSupabase,getUserId=()=>window.tikInteractUser?.id}={}){
 const own=getUserId();if(!own)throw Error('ANIM_LOGIN_REQUIRED');
 const {data}=await client.auth.getSession();
 const token=data?.session?.access_token||window.tikInteractAccessToken;if(!token)throw Error('ANIM_LOGIN_REQUIRED');
 const response=await fetch('/api/animations',{method:'POST',headers:{'Content-Type':'application/json',Authorization:'Bearer '+token},body:JSON.stringify(body),cache:'no-store',signal:signal||AbortSignal.timeout(125000)});
 const result=await response.json().catch(()=>({error:'ANIM_UNAVAILABLE'}));if(own!==getUserId())throw Error('ANIM_ACCOUNT_CHANGED');if(!response.ok)throw Error(result.error||'ANIM_UNAVAILABLE');if(['saveRule','deleteRule','deleteMedia','deleteData'].includes(body.action))window.dispatchEvent(new CustomEvent('tikinteract:animation-rules-changed'));return result;
}
export const animationText=(ro,en)=>window.TikInteractLanguage?.get()==='en'?en:ro;
export function animationError(code){
 const messages={
  ANIM_SETUP_REQUIRED:['Leagă modulul la Supabase pentru a-l folosi. Configurarea backendului nu este încă finalizată.','Connect this module to Supabase. Backend setup is not complete yet.'],
  ANIM_ACTIVATION_REQUIRED:['Generarea AI așteaptă activarea și aprobarea primului test.','AI generation is awaiting activation and first-test approval.'],
  ANIM_DISABLED:['Generarea este oprită de administrator.','Generation is disabled by the administrator.'],
  ANIM_INSUFFICIENT_CREDITS:['Nu ai suficiente credite. Poți reîncărca și cu planul FREE.','Not enough credits. You can top up on the FREE plan too.'],
  ANIM_CONTENT_REJECTED:['Conținutul nu a fost aprobat. Creditele eligibile sunt restituite.','The content was not approved. Eligible credits are returned.'],
  ANIM_CREDIT_DEBT:['Există credite de regularizat după o rambursare. Contactează suportul.','Credits require reconciliation after a refund. Contact support.'],
  ANIM_CONCURRENCY:['Ai deja o generare activă. Așteaptă finalizarea ei.','You already have an active generation. Wait for it to finish.'],
  ANIM_CHECKOUT_UNAVAILABLE:['Reîncărcarea prin Stripe nu este încă activată.','Stripe top-ups are not enabled yet.'],
  ANIM_PRICING_REQUIRED:['Costurile în credite nu au fost configurate.','Credit costs have not been configured.'],
  ANIM_MARGIN_TOO_LOW:['Configurația nu respectă marja minimă introdusă. Verifică prețurile, TVA, comisioanele și costurile AI.','This configuration does not meet the configured minimum margin. Check pricing, tax, fees and AI costs.'],
  ANIM_MEDIA_IN_USE:['Fotografia este folosită de o generare activă.','This photo is used by an active generation.'],
  ANIM_GLOBAL_BUDGET:['Limita globală AI a fost atinsă. Încearcă mai târziu.','The global AI budget has been reached. Try again later.'],
  ANIM_USER_BUDGET:['Ai atins limita lunară de procesare.','You have reached the monthly processing limit.'],
  ANIM_RATE_LIMIT:['Prea multe cereri. Așteaptă un minut.','Too many requests. Wait a minute.'],
  ANIM_SUBMISSION_UNCERTAIN:['Furnizorul necesită verificare. Nu se pornește automat o altă generare.','The provider request needs review. Another generation will not start automatically.'],
  ANIM_LOGIN_REQUIRED:['Intră în cont pentru a continua.','Sign in to continue.']
 };
 return messages[code]?animationText(...messages[code]):animationText('Operațiunea nu a reușit. Reîncearcă sau contactează suportul.','The action failed. Try again or contact support.');
}
