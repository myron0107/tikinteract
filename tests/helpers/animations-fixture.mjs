// Local-only PostgreSQL + controlled storage/provider fixture. No external fetch.
import {PGlite} from '@electric-sql/pglite';
import {readFile} from 'node:fs/promises';
import {AnimationError} from '../../lib/animations-store.js';
export const animationUser='10000000-0000-0000-0000-000000000001';
export async function createAnimationFixture({origin='http://127.0.0.1:3031'}={}){
 const db=new PGlite(),files=new Map(),calls=[];
 await db.exec(`create role anon;create role authenticated;create role service_role bypassrls;create schema auth;create schema storage;
 create table auth.users(id uuid primary key);insert into auth.users values('${animationUser}');
 create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;
 create table storage.buckets(id text primary key,name text,public boolean,file_size_limit bigint,allowed_mime_types text[]);
 create table public.billing_orders(id uuid primary key,user_id uuid,plan text,status text,paid_at timestamptz,live boolean);
 create table public.account_access_grants(source_payment uuid,starts_at timestamptz,ends_at timestamptz);
 create table public.site_settings(singleton boolean primary key,published jsonb);insert into public.site_settings values(true,'{"plans":[{"id":"play_pass","priceCents":2900},{"id":"play_pass_pro","priceCents":7900}]}');`);
 await db.exec(await readFile(new URL('../../supabase/animations.sql',import.meta.url),'utf8'));
 await db.exec(`update public.animation_settings set config=config||'{"enabled":true,"standardCredits":10,"premiumCredits":30,"standardUsdMicros":240000,"premiumUsdMicros":650000,"dailyUsdMicros":10000000,"userMonthlyUsdMicros":3000000,"packages":[{"id":"credits-100","credits":100,"amount":2500,"currency":"ron","enabled":true}]}'::jsonb`);
 const table=name=>{if(!/^(animation_\w+|site_settings)$/.test(name))throw Error('Unexpected fixture table');return 'public.'+name;};
 const where=(filters,start=1)=>Object.keys(filters).map((k,i)=>`"${k}"=$${i+start}`).join(' and ')||'true';
 const values=obj=>Object.values(obj).map(v=>v!==null&&typeof v==='object'&&!Array.isArray(v)?JSON.stringify(v):v);
 const store={ready:true,
  authenticate:async r=>{if(!r.headers.get('authorization'))throw new AnimationError('ANIM_LOGIN_REQUIRED',401);return {id:animationUser,email:'fixture@example.invalid'};},
  admin:async()=>{},
  rpc:async(name,args)=>{const keys=Object.keys(args);return(await db.query(`select public.${name}(${keys.map((k,i)=>`${k}=>$${i+1}`).join(',')}) as data`,values(args))).rows[0].data;},
  one:async(name,filters)=>(await db.query(`select * from ${table(name)} where ${where(filters)} limit 1`,values(filters))).rows[0]||null,
  list:async(name,filters={},limit=100)=>(await db.query(`select * from ${table(name)} where ${where(filters)} ${name==='animation_universes'?'':'order by created_at desc'} limit ${Number(limit)}`,values(filters))).rows,
  insert:async(name,row)=>(await db.query(`insert into ${table(name)}(${Object.keys(row).join(',')}) values(${Object.keys(row).map((_,i)=>'$'+(i+1)).join(',')}) returning *`,values(row))).rows[0],
  update:async(name,filters,row)=>(await db.query(`update ${table(name)} set ${Object.keys(row).map((k,i)=>`"${k}"=$${i+1}`).join(',')} where ${where(filters,Object.keys(row).length+1)} returning *`,[...values(row),...values(filters)])).rows,
  remove:async(name,filters)=>db.query(`delete from ${table(name)} where ${where(filters)}`,values(filters)),
  sign:async(path)=>origin+'/__media?path='+encodeURIComponent(path),
  check:r=>{if(r.error)throw r.error;return r.data;},
  bucket:{
   createSignedUploadUrl:async path=>({data:{path,token:'fixture-token'}}),
   upload:async(path,bytes)=>{files.set(path,Buffer.from(bytes));return {data:{path}};},
   download:async path=>files.has(path)?{data:new Blob([files.get(path)])}:{error:Error('Missing fixture file')},
   remove:async paths=>{for(const path of paths)files.delete(path);return {data:[]};}
  }
 };
 const image=await readFile(new URL('../../assets/animations-demo/vampire.jpg',import.meta.url));
 const video=await readFile(new URL('../../assets/tikinteract-animation.mp4',import.meta.url));
 const provider={ready:true,
  submitImage:async job=>{calls.push({type:'image',job:job.id});return {request_id:'image-'+job.id};},
  submitVideo:async job=>{calls.push({type:'video',job:job.id});return {request_id:'video-'+job.id};},
  status:async()=>({status:'COMPLETED'}),
  result:async(model)=>model.includes('kontext')?{images:[{url:'https://fixture.fal.media/image.jpg'}],has_nsfw_concepts:[false]}:{video:{url:'https://fixture.fal.media/video.mp4'}},
  download:async(url,mime)=>mime==='video/mp4'?video:image
 };
 const user={id:animationUser,email:'fixture@example.invalid'};
 const grant=(credits=100)=>store.rpc('animation_grant',{p_user:user.id,p_source:'fixture:'+crypto.randomUUID(),p_kind:'purchased',p_credits:credits,p_expires:null,p_test:true});
 const addPhoto=async()=>{const id=crypto.randomUUID(),path=`${user.id}/${id}.jpg`;files.set(path,image);await store.insert('animation_media',{id,user_id:user.id,path,mime:'image/jpeg',bytes:image.length,title:'Photo',world:'vampire',format:'9:16',kind:'photo',ready:true});return id;};
 return {db,store,provider,user,files,calls,image,video,grant,addPhoto};
}
