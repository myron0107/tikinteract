// Pure matching shared with the server. Rules can never start AI or payments.
export function matchesAnimationRule(rule,event){
 if(!rule.enabled||event?.type!=='gift'||event.demo===true)return false;
 const username=String(rule.username||'').trim().replace(/^@/,'').toLowerCase(),sender=String(event.username||'').trim().replace(/^@/,'').slice(0,30).toLowerCase();
 if(username&&username!==sender)return false;
 const quantity=Math.max(1,Math.min(10000,Number(event.repeatCount)||1)),coins=Math.max(0,Math.min(1000000,Number(event.coins)||0));
 const gift=String(rule.gift||'').trim().toLowerCase();
 return rule.type==='gift'&&!!gift&&(gift===String(event.giftId)||gift===String(event.giftName||'').trim().slice(0,100).toLowerCase())&&quantity>=rule.threshold||rule.type==='user'&&!!username&&username===sender||rule.type==='threshold'&&coins>=rule.threshold;
}
