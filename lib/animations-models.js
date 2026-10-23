// Server-side model registry. Model IDs/input builders stay outside the UI.
export const MODEL_REVIEW_DATE='2026-10-23';
export const IMAGE_MODEL='fal-ai/flux-pro/kontext';
export const VIDEO_MODELS={standard:'minimax/h3-max-turbo/image-to-video',premium:'fal-ai/kling-video/o1/reference-to-video'};
export const WORLD_PROMPTS={
 vampire:'an original regal vampire in a gothic castle, velvet cape, crimson moonlight',
 knights:'an original medieval knight in polished armour, a golden fortress',
 superhero:'an original superhero, no existing franchise costume, cinematic city skyline',
 galactic:'an original space explorer, futuristic armour, a distant galactic empire',
 military:'an original adult soldier in fictional tactical equipment, non-graphic cinematic scene',
 fantasy:'an original dark fantasy adventurer in mystical ruins',
 cyberpunk:'an original cyberpunk character, rain, neon city, cinematic lighting',
 anime:'an original expressive anime character, vibrant fantasy world'
};
export function imageInput(job,url,world){return {image_url:url,prompt:`Transform the adult person in the reference photo into ${world}. Preserve visible facial features as closely as possible. Keep the same person, fully clothed, no text or watermark. Compose a cinematic full character scene in ${job.format}.`,aspect_ratio:job.format,num_images:1,output_format:'jpeg',safety_tolerance:'1'};}
export function videoInput(job,image,photo,world){
 const prompt=`${job.tier==='premium'?'Use @Element1 as the main character; @Image1 defines the scene and costume. ':''}${world}. Action: ${job.prompt}. Cinematic motion and lighting. Preserve character appearance, fully clothed, non-graphic scene. No text or watermark.`;
 return job.tier==='premium'?{prompt,image_urls:[image],elements:[{frontal_image_url:photo,reference_image_urls:[image]}],duration:'5',aspect_ratio:job.format,enable_safety_checker:true}:{prompt,image_url:image,duration:5,resolution:'768P',prompt_expansion_mode:'disabled',enable_safety_checker:true};
}
export function validateGeneration(body){
 if(!body||!['standard','premium'].includes(body.tier)||!['16:9','9:16'].includes(body.format)||body.duration!==5||body.consent!==true||typeof body.prompt!=='string'||body.prompt.trim().length<8||body.prompt.length>1200||typeof body.title!=='string'||body.title.length>80)throw Error('ANIM_INVALID');
 // First pass only. Every input image and prompt also requires human moderation
 // before any paid call; provider safety checkers remain enabled afterwards.
 if(/\b(nude|naked|porn|sexual|rape|minor|child|underage|kill|gore|dezbr[aă]cat|nuditate|sexual|viol|copil|minor)\b/iu.test(body.prompt))throw Error('ANIM_CONTENT_REJECTED');
 return {tier:body.tier,format:body.format,duration:5,consent:true,prompt:body.prompt.trim(),title:body.title.trim()||'Animation',world:body.world,photo_id:body.photoId};
}
export function profitability({grossCents,taxBps,stripeBps,stripeFixedCents,affiliateBps,infrastructureCents,creditCount,costUsdMicros,usdToCurrency,minimumMarginBps}){
 const net=grossCents/(1+taxBps/10000)-grossCents*(stripeBps+affiliateBps)/10000-stripeFixedCents-infrastructureCents;
 const aiCents=costUsdMicros/1000000*usdToCurrency*100*creditCount;
 return {netCents:net,aiCents,marginBps:net>0?(net-aiCents)/net*10000:-10000,acceptable:net>0&&aiCents<=net*(1-minimumMarginBps/10000)};
}
