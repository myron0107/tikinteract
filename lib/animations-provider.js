import {createFalClient} from '@fal-ai/client';
import {imageInput,videoInput} from './animations-models.js';
import {AnimationError} from './animations-store.js';
export function createAnimationProvider({key=process.env.FAL_KEY||'',fetchImpl=fetch}={}){
 async function request(method,...args){
  const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),20000);
  // The SDK has queue-specific retries that override config.retry. An aborted
  // operation signal also disables those retries, including ambiguous POSTs.
  const client=createFalClient({credentials:key||'not-configured',retry:{maxRetries:0},fetch:async(url,options)=>{
   try{const response=await fetchImpl(url,{...options,signal:controller.signal});if(!response.ok)controller.abort();return response;}catch(e){controller.abort();throw e;}
  }});
  try{return await client.queue[method](args[0],{...args[1],abortSignal:controller.signal});}finally{clearTimeout(timer);}
 }
 async function download(url,mime,maxBytes){
  let u;try{u=new URL(url);}catch{throw new AnimationError('ANIM_INVALID_PROVIDER_FILE');}
  // No arbitrary user URL, redirects, private network targets or provider error
  // body persisted into the private library.
  if(u.protocol!=='https:'||u.username||u.password||u.port||!(u.hostname==='fal.media'||u.hostname.endsWith('.fal.media')))throw new AnimationError('ANIM_INVALID_PROVIDER_FILE');
  const response=await fetchImpl(u,{redirect:'error',signal:AbortSignal.timeout(45000)});
  if(!response.ok||Number(response.headers.get('content-length'))>maxBytes||!response.headers.get('content-type')?.startsWith(mime))throw new AnimationError('ANIM_INVALID_PROVIDER_FILE');
  const reader=response.body.getReader(),chunks=[];let size=0;
  try{while(true){const {done,value}=await reader.read();if(done)break;size+=value.length;if(size>maxBytes)throw new AnimationError('ANIM_INVALID_PROVIDER_FILE');chunks.push(value);}}finally{await reader.cancel().catch(()=>{});}
  return Buffer.concat(chunks);
 }
 return {ready:!!key,
  submitImage:(job,url,world)=>request('submit',job.image_model,{input:imageInput(job,url,world),headers:{'X-Fal-Tags':`feature=animations,job=${job.id},stage=image`}}),
  submitVideo:(job,image,photo,world)=>request('submit',job.video_model,{input:videoInput(job,image,photo,world),headers:{'X-Fal-Tags':`feature=animations,job=${job.id},stage=video`}}),
  status:(model,id)=>request('status',model,{requestId:id,logs:false}),
  result:async(model,id)=>(await request('result',model,{requestId:id})).data,
  download
 };
}
