// Pure matching shared with the server. Rules can never start AI or payments.
export function matchesAnimationRule(rule,event){
 if(!rule.enabled||event?.type!=='gift'||event.demo===true)return false;
 const quantity=Math.max(1,Math.min(10000,Number(event.repeatCount)||1)),coins=Math.max(0,Math.min(1000000,Number(event.coins)||0));
 return rule.type==='gift'&&(rule.gift===String(event.giftId)||rule.gift.toLowerCase()===String(event.giftName||'').trim().slice(0,100).toLowerCase())&&quantity>=rule.threshold||rule.type==='user'&&rule.username.toLowerCase()===String(event.username||'').trim().slice(0,30).toLowerCase()||rule.type==='threshold'&&coins>=rule.threshold;
}
