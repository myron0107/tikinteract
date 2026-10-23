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
  INVALID_ORIGIN:['Conexiunea cu AI Studio a fost refuzată pentru această adresă. Reîncarcă pagina; dacă problema continuă, contactează suportul.','The AI Studio connection was rejected for this address. Reload the page; if it continues, contact support.'],
  ANIM_ACCOUNT_REQUIRED:['AI Studio necesită un cont înregistrat, cu adresa de e-mail confirmată. Conturile temporare de previzualizare nu pot folosi funcțiile AI.','AI Studio requires a registered account with a confirmed email address. Temporary preview accounts cannot use AI features.'],
  ANIM_COMMERCE_SETUP:['Rulează supabase/animations-commerce.sql după animations.sql pentru a activa configurația comercială de test.','Run supabase/animations-commerce.sql after animations.sql to install test commerce.'],
  ANIM_TEST_ONLY:['Această ofertă este disponibilă doar în Stripe Test Mode. Configurează cheile de test pe server.','This offer is available only in Stripe Test Mode. Configure server test keys.'],
  ANIM_PRICE_REQUIRED:['Lipsește Price ID-ul Stripe de test al ofertei.','The offer is missing its Stripe test Price ID.'],
  ANIM_PRICE_MISMATCH:['Price ID-ul Stripe nu corespunde prețului, monedei sau tipului de plată configurat. Creează un Price nou în Test Mode.','The Stripe Price ID does not match the configured amount, currency or payment type. Create a new Price in Test Mode.'],
  ANIM_PRICE_TERMS:['Acest Price ID a fost deja folosit cu alte condiții. Creează un Price nou pentru oferta modificată.','This Price ID was already used with different terms. Create a new Price for the changed offer.'],
  ANIM_SUBSCRIPTION_EXISTS:['Ai deja un abonament de test sau o comandă de abonament în așteptare. Verifică în Stripe Test înainte de altă achiziție.','You already have a test subscription or a pending subscription order. Check Stripe Test before another purchase.'],
  ANIM_CONFIG_CONFLICT:['Configurația s-a schimbat. Reîncarcă secțiunea înainte să salvezi.','Configuration changed. Reload this section before saving.'],
  ANIM_CONFIG_INVALID:['Verifică valorile introduse. FREE rămâne 0 € / 0 credite; Price ID-urile trebuie să fie distincte.','Check the entered values. FREE stays €0 / 0 credits; Price IDs must be distinct.'],
  ANIM_COST_SYNC_UNAVAILABLE:['Citirea costurilor fal.ai nu este configurată sau cheia nu are permisiuni de facturare.','fal.ai cost reporting is not configured, or the key lacks billing permissions.'],
  ANIM_COST_REVIEW:['Raportul costului necesită verificare. Cererile fără identificator sau mai vechi de 89 de zile nu se sincronizează automat.','The cost report needs review. Requests without an ID or older than 89 days cannot be synced automatically.'],
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
