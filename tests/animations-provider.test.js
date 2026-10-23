import test from 'node:test';
import assert from 'node:assert/strict';
import {createAnimationProvider} from '../lib/animations-provider.js';
test('Official fal SDK submits once on ambiguous transport failure or 503; no hidden paid request retry',async()=>{
 for(const transport of ['network','503']){
  let calls=0;const p=createAnimationProvider({key:'fixture-only',fetchImpl:async()=>{calls++;if(transport==='network')throw Error('connection reset');return Response.json({detail:'Unavailable'},{status:503});}});
  await assert.rejects(p.submitImage({image_model:'fal-ai/flux-pro/kontext',format:'9:16'},'https://private.invalid/photo','vampire'));
  assert.equal(calls,1);
 }
});
test('Provider files reject arbitrary/private hosts, redirects, wrong media types and oversized payloads',async()=>{
 let calls=0;const p=createAnimationProvider({fetchImpl:async()=>{calls++;return new Response('not video',{headers:{'Content-Type':'text/html'}});}});
 for(const url of ['http://fal.media/video.mp4','https://127.0.0.1/video.mp4','https://fal.media.evil.invalid/video.mp4','https://x:password@fal.media/video.mp4'])await assert.rejects(p.download(url,'video/mp4',100),/ANIM_INVALID_PROVIDER_FILE/);
 assert.equal(calls,0);await assert.rejects(p.download('https://v3.fal.media/video.mp4','video/mp4',100),/ANIM_INVALID_PROVIDER_FILE/);
 const large=createAnimationProvider({fetchImpl:async()=>new Response(Buffer.alloc(101),{headers:{'Content-Type':'video/mp4'}})});await assert.rejects(large.download('https://v3.fal.media/video.mp4','video/mp4',100),/ANIM_INVALID_PROVIDER_FILE/);
});
