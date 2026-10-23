import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {normalizeLayout,packPanels,overlaps,moveFavorite} from '../assets/studio-personalization-model.js';
import {createAnimationFixture} from './helpers/animations-fixture.mjs';
test('Layout model upgrades old columns to fine canvas coordinates, clamps sizes and preserves intentional placements',()=>{
 const d=normalizeLayout({custom:true,desktop:[{id:'preview',x:99,y:-1,w:99,h:999,hidden:false},{id:'preview',x:1,y:1,w:3,h:4},{id:'foreign',x:1,y:1,w:3,h:4}],favorites:{games:['nova-vex','nova-vex','<script>'],audio:Array.from({length:30},(_,i)=>'sound-'+i)}});
 assert.equal(d.version,2);assert.equal(d.desktop.filter(p=>p.id==='preview').length,1);const p=d.desktop.find(p=>p.id==='preview');assert.equal(p.w,1268);assert.equal(p.x,0);assert.equal(p.h,1428);
 assert(d.mobile.every(p=>p.x===0&&p.w===384));assert.equal(d.favorites.audio.length,12);assert.deepEqual(d.favorites.games,['nova-vex']);
 for(const mode of ['desktop','mobile'])for(const a of d[mode])for(const b of d[mode])if(a.id!==b.id)assert.equal(overlaps(a,b),false);
 const resized=packPanels(d.desktop.map(p=>p.id==='games'?{...p,x:4,y:1,w:6,h:8}:p),'games');assert.equal(resized[0].id,'games');for(const a of resized)for(const b of resized)if(a.id!==b.id)assert.equal(overlaps(a,b),false);
 assert.deepEqual(moveFavorite(['a','b','c'],'c','a'),['c','a','b']);assert.deepEqual(moveFavorite(['a','b','c'],'a',null),['b','c','a']);
 const free=normalizeLayout({version:2,custom:true,desktop:[{id:'games',x:24,y:16,w:240,h:240},{id:'audio',x:24,y:16,w:240,h:240}]});assert.equal(free.desktop.find(p=>p.id==='audio').y,16,'Do not push freely placed panels back into columns');
});
test('PostgreSQL: private per-user profiles, cross-device active selection, optimistic saves, validation and bounded profile count',async()=>{
 const f=await createAnimationFixture(),other='10000000-0000-0000-0000-000000000002';try{
  const sql=await readFile(new URL('../supabase/studio-workspaces.sql',import.meta.url),'utf8');await f.db.exec(sql);await f.db.exec(sql);
  await f.db.exec(`insert into auth.users values('${other}');set request.jwt.claim.sub='${f.user.id}';set role authenticated`);
  const call=async(name,values=[])=>{const params=values.map(v=>v&&typeof v==='object'?JSON.stringify(v):v);return(await f.db.query(`select public.${name}(${params.map((_,i)=>'$'+(i+1)).join(',')}) result`,params)).rows[0].result;};
  assert.deepEqual(await call('studio_layout_list'),{profiles:[],active:null});
  const id=crypto.randomUUID(),layout=normalizeLayout({custom:true,favorites:{games:['nova-vex'],audio:['sound-01'],animations:[]}}),row=await call('studio_layout_save',[id,'My desk',layout,0,f.user.id]);assert.equal(row.revision,1);
  assert.equal((await call('studio_layout_list')).active,id);assert.equal((await call('studio_layout_list')).profiles[0].layout.favorites.audio[0],'sound-01');
  await assert.rejects(call('studio_layout_save',[id,'Stale client',layout,0,f.user.id]),/LAYOUT_CONFLICT/);
  assert.equal((await call('studio_layout_save',[id,'Updated',layout,1,f.user.id])).revision,2);
  await assert.rejects(call('studio_layout_save',[crypto.randomUUID(),'Account switched',layout,0,other]),/LAYOUT_FORBIDDEN/);
  await f.db.exec(`reset role;set request.jwt.claim.sub='${other}';set role authenticated`);assert.equal((await call('studio_layout_list')).profiles.length,0);
  assert.equal((await f.db.query('select * from studio_layout_profiles')).rows.length,0);await assert.rejects(call('studio_layout_save',[id,'Stolen',layout,2,other]),/LAYOUT_FORBIDDEN/);await assert.rejects(call('studio_layout_select',[id]),/LAYOUT_FORBIDDEN/);await assert.rejects(call('studio_layout_delete',[id]),/LAYOUT_FORBIDDEN/);
  await assert.rejects(f.db.exec('update studio_layout_profiles set name=\'hack\''),/permission denied/);
  await f.db.exec(`reset role;set request.jwt.claim.sub='${f.user.id}';set role authenticated`);
  for(const mutate of [x=>x.desktop.push(x.desktop[0]),x=>x.desktop[0].w=1281,x=>x.mobile[0].id='bad<id>',x=>x.favorites.audio=Array(13).fill('sound-01')]){const bad=structuredClone(layout);mutate(bad);await assert.rejects(call('studio_layout_save',[id,'Invalid',bad,2,f.user.id]),/LAYOUT_INVALID/);}
  for(let i=0;i<7;i++)await call('studio_layout_save',[crypto.randomUUID(),'Desk '+i,layout,0,f.user.id]);await assert.rejects(call('studio_layout_save',[crypto.randomUUID(),'Ninth',layout,0,f.user.id]),/LAYOUT_LIMIT/);
  await call('studio_layout_select',[id]);await call('studio_layout_delete',[id]);assert.equal((await call('studio_layout_list')).active,null);
 }finally{await f.db.close();}
});
test('Shared animation usage summary is server-only and never blends Test with live wallets',async()=>{
 const f=await createAnimationFixture();try{
  await f.db.exec(await readFile(new URL('../supabase/animations-studios.sql',import.meta.url),'utf8'));await f.db.exec(await readFile(new URL('../supabase/animations-studios.sql',import.meta.url),'utf8'));
  assert.deepEqual(await f.store.rpc('animation_account_usage',{p_user:f.user.id,p_test:true}),{consumed:0,reserved:0,completed:0});
  await f.grant(100);const photo=await f.addPhoto();await f.store.rpc('animation_reserve',{p_user:f.user.id,p_request:crypto.randomUUID(),p_input:{photo_id:photo,world:'vampire',tier:'standard',title:'Test',prompt:'Waves to everyone',format:'9:16'},p_image_model:'image',p_video_model:'video'});
  assert.equal((await f.store.rpc('animation_account_usage',{p_user:f.user.id,p_test:true})).reserved,10);assert.equal((await f.store.rpc('animation_account_usage',{p_user:f.user.id,p_test:false})).reserved,0);
  await f.db.exec('set role authenticated');await assert.rejects(f.db.query('select animation_account_usage($1,true)',[f.user.id]),/permission denied/);
 }finally{await f.db.close();}
});

test('Platform defaults require owner/admin, strip personal data, preserve profiles and reject conflicting publication',async()=>{
 const f=await createAnimationFixture(),other='10000000-0000-0000-0000-000000000002';try{
  await f.db.exec(await readFile(new URL('../supabase/studio-workspaces.sql',import.meta.url),'utf8'));
  await f.db.exec(`insert into auth.users values('${other}');create function public.site_admin_role() returns text language sql stable as $$select nullif(current_setting('qa.admin_role',true),'')$$;set request.jwt.claim.sub='${f.user.id}';set role authenticated`);
  const call=async(name,args=[])=>{return(await f.db.query(`select public.${name}(${args.map((_,i)=>'$'+(i+1)).join(',')}) result`,args.map(v=>v&&typeof v==='object'?JSON.stringify(v):v))).rows[0].result;};
  const layout=normalizeLayout({custom:true,favorites:{games:['nova-vex'],audio:['sound-01'],animations:[crypto.randomUUID()]}});layout.desktop[0].private='must not publish';layout.private='secret';
  assert.equal((await call('studio_layout_context')).can_publish,false);await assert.rejects(call('studio_layout_publish_default',[layout,0]),/LAYOUT_ADMIN_REQUIRED/);
  await f.db.exec("set qa.admin_role='editor'");await assert.rejects(call('studio_layout_publish_default',[layout,0]),/LAYOUT_ADMIN_REQUIRED/);
  await f.db.exec("set qa.admin_role='owner'");assert.equal((await call('studio_layout_context')).can_publish,true);
  const id=crypto.randomUUID();await call('studio_layout_save',[id,'Personal',layout,0,f.user.id]);const before=await call('studio_layout_list');
  const published=await call('studio_layout_publish_default',[layout,0]);assert.equal(published.revision,1);assert.deepEqual(published.layout.favorites,{games:[],audio:[],animations:[]});assert.equal(published.layout.private,undefined);assert.equal(published.layout.desktop[0].private,undefined);
  assert.deepEqual(await call('studio_layout_list'),before,'Publishing must never overwrite saved personal profiles');await assert.rejects(call('studio_layout_publish_default',[layout,0]),/LAYOUT_CONFLICT/);
  await f.db.exec(`reset role;set request.jwt.claim.sub='${other}';set qa.admin_role='';set role authenticated`);const context=await call('studio_layout_context');assert.equal(context.can_publish,false);assert.deepEqual(context.default.layout,published.layout);assert.equal((await call('studio_layout_list')).profiles.length,0);
  await assert.rejects(f.db.query('select * from studio_layout_default'),/permission denied/);await assert.rejects(f.db.query('select studio_layout_validate($1)',[JSON.stringify(layout)]),/permission denied/);
  await f.db.exec("set qa.admin_role='admin'");assert.equal((await call('studio_layout_publish_default',[null,1])).layout,null,'Admin can revert to the original shell');
 }finally{await f.db.close();}
});
