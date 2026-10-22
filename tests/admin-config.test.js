import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {PGlite} from '@electric-sql/pglite';
import {DEFAULT_CONFIG,cloneConfig,validateConfig,studioVisibility,STUDIO_SECTIONS} from '../assets/platform-schema.js';

test('Studio visibility accepts legacy configs and validates independent reversible switches',()=>{
 const legacy=validateConfig(DEFAULT_CONFIG);assert.deepEqual(legacy.studio.visibility,Object.fromEntries(Object.keys(STUDIO_SECTIONS).map(k=>[k,true])));
 const hidden=cloneConfig(DEFAULT_CONFIG);hidden.studio.visibility={animations:false,games:false};
 assert.deepEqual(studioVisibility(validateConfig(hidden)),{studio:true,games:false,audio:true,animations:false,guide:true,website:true});
 for(const visibility of [null,[],{animations:'false'},{unknown:false}]){const invalid=cloneConfig(DEFAULT_CONFIG);invalid.studio.visibility=visibility;assert.throws(()=>validateConfig(invalid));}
 hidden.studio.visibility=Object.fromEntries(Object.keys(STUDIO_SECTIONS).map(k=>[k,false]));assert.doesNotThrow(()=>validateConfig(hidden));
});

test('configuration rejects invalid money, duplicate panels and unsafe game URLs',()=>{
 assert.doesNotThrow(()=>validateConfig(DEFAULT_CONFIG));
 for(const mutate of [c=>c.plans[1].priceCents=-1,c=>c.plans[1].priceCents=1.2,c=>c.studio.right.push('games'),c=>c.games[0].entryPath='../admin.html',c=>c.games[0].cover='javascript:alert(1)',c=>c.games.push(c.games[0])]){const c=cloneConfig(DEFAULT_CONFIG);mutate(c);assert.throws(()=>validateConfig(c));}
});

test('real PostgreSQL enforces staff roles, private drafts, publication and owner protection',async()=>{
 const db=new PGlite();
 const ids={owner:'10000000-0000-0000-0000-000000000001',editor:'10000000-0000-0000-0000-000000000002',admin:'10000000-0000-0000-0000-000000000003',visitor:'10000000-0000-0000-0000-000000000004'};
 try{
  await db.exec(`create role anon;create role authenticated;create schema auth;create schema storage;
   create table auth.users(id uuid primary key,email text,email_confirmed_at timestamptz,is_anonymous boolean default false);
   create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;
   grant usage on schema auth,storage to anon,authenticated;grant execute on function auth.uid() to anon,authenticated;
   create table storage.buckets(id text primary key,name text,public boolean,file_size_limit bigint,allowed_mime_types text[]);
   create table storage.objects(id uuid default gen_random_uuid(),bucket_id text,name text);alter table storage.objects enable row level security;
   grant insert on storage.objects to authenticated;
   create function storage.foldername(text) returns text[] language sql immutable as $$select string_to_array($1,'/')$$;grant execute on function storage.foldername(text) to authenticated;
   insert into auth.users(id,email,email_confirmed_at) values('${ids.owner}','mironsergiuflorin@gmail.com',now()),('${ids.editor}','editor@example.invalid',now()),('${ids.admin}','admin@example.invalid',now()),('${ids.visitor}','visitor@example.invalid',now());`);
  const migration=await readFile(new URL('../supabase/admin.sql',import.meta.url),'utf8');
  await db.exec(migration);await db.exec(migration); // Activation is safely rerunnable.
  async function as(role,user,sql,args=[]){await db.exec(`reset role;set request.jwt.claim.sub='${user||''}';set role ${role}`);try{return await db.query(sql,args);}finally{await db.exec('reset role');}}
  const call=(user,sql,args)=>as('authenticated',ids[user],sql,args);
  const state=async user=>(await call(user,'select public.get_site_admin_state() as data')).rows[0].data;
  let publicData=(await as('anon',null,'select public.get_site_public_config() as data')).rows[0].data;
  assert(!('draft' in publicData));assert.equal(publicData.config.plans[1].priceCents,2900);
  await assert.rejects(as('anon',null,'select public.get_site_admin_state()'),/permission denied/);
  await assert.rejects(call('visitor','select public.get_site_admin_state()'),/ADMIN_REQUIRED/);
  await assert.rejects(call('visitor',`insert into public.site_admins(user_id,role) values('${ids.visitor}','owner')`),/permission denied/);
  await assert.rejects(call('visitor','select draft from public.site_settings'),/permission denied/);
  await call('owner',"select public.manage_site_admin('editor@example.invalid','editor')");
  await call('owner',"select public.manage_site_admin('admin@example.invalid','admin')");
  let next=cloneConfig(DEFAULT_CONFIG);next.plans[1].priceCents=3500;
  await call('editor','select public.save_site_config($1::jsonb,0,false)',[JSON.stringify(next)]);
  publicData=(await as('anon',null,'select public.get_site_public_config() as data')).rows[0].data;
  assert.equal(publicData.config.plans[1].priceCents,2900,'Draft must not leak to public visitors');
  await assert.rejects(call('editor','select public.save_site_config($1::jsonb,1,true)',[JSON.stringify(next)]),/ADMIN_REQUIRED/);
  await assert.rejects(call('editor',"select public.manage_site_admin('visitor@example.invalid','owner')"),/OWNER_REQUIRED/);
  await assert.rejects(call('admin','select public.list_site_admins()'),/OWNER_REQUIRED/);
  await call('admin','select public.save_site_config($1::jsonb,1,true)',[JSON.stringify(next)]);
  publicData=(await as('anon',null,'select public.get_site_public_config() as data')).rows[0].data;
  assert.equal(publicData.config.plans[1].priceCents,3500);
  await assert.rejects(call('owner','select public.save_site_config($1::jsonb,1,true)',[JSON.stringify(next)]),/CONFIG_CONFLICT/);
  const invalid=cloneConfig(next);invalid.plans[1].priceCents=-1;
  await assert.rejects(call('owner','select public.save_site_config($1::jsonb,2,true)',[JSON.stringify(invalid)]),/Invalid price/);
  invalid.plans[1].priceCents=100;invalid.studio.right.push('games');
  await assert.rejects(call('owner','select public.save_site_config($1::jsonb,2,true)',[JSON.stringify(invalid)]),/Each Studio panel/);
  const latest=await state('owner'),initial=latest.history.find(h=>h.action==='initial');
  await call('editor','select public.restore_site_config($1,2)',[initial.id]);
  assert.equal((await state('owner')).draft.plans[1].priceCents,2900);
  assert.equal((await as('anon',null,'select public.get_site_public_config() as data')).rows[0].data.config.plans[1].priceCents,3500,'Restoration must remain a draft');
  await assert.rejects(call('owner',"select public.manage_site_admin('mironsergiuflorin@gmail.com',null)"),/Ultimul proprietar/);
  await assert.rejects(call('visitor',"insert into storage.objects(bucket_id,name) values('site-media','"+ids.visitor+"/cover.webp')"),/row-level security/);
  await assert.rejects(call('editor',"insert into storage.objects(bucket_id,name) values('site-media','"+ids.owner+"/cover.webp')"),/row-level security/);
  await call('editor',"insert into storage.objects(bucket_id,name) values('site-media','"+ids.editor+"/cover.webp')");
  await call('owner',"select public.manage_site_admin('editor@example.invalid',null)");
  await assert.rejects(call('editor','select public.get_site_admin_state()'),/ADMIN_REQUIRED/);
  const withDraft=cloneConfig((await state('owner')).draft);withDraft.games.push({...withDraft.games[0],id:'secret-prototype',name:'Private prototype',status:'draft'});
  await call('owner','select public.save_site_config($1::jsonb,3,true)',[JSON.stringify(withDraft)]);
  const publishedJSON=(await as('anon',null,'select public.get_site_public_config() as data')).rows[0].data;
  assert(!JSON.stringify(publishedJSON).includes('secret-prototype'),'Draft game metadata must not leak through public configuration');
  await call('owner',"select public.manage_site_admin('admin@example.invalid','owner')");
  await call('owner',"select public.manage_site_admin('mironsergiuflorin@gmail.com','editor')");
  assert.equal((await state('owner')).role,'editor','An owner can hand over ownership when another owner exists');
  await assert.rejects(call('admin',"select public.manage_site_admin('admin@example.invalid','editor')"),/Ultimul proprietar/);
  await db.exec(migration);
  assert.equal((await state('owner')).role,'editor','Rerunning setup must not undo a deliberate ownership handover');
  // Existing JSON configuration persists the switches with no SQL migration.
  const visibilityState=await state('admin'),hidden=cloneConfig(visibilityState.draft);hidden.studio.visibility={animations:false,audio:false};
  await call('admin','select public.save_site_config($1::jsonb,$2,false)',[JSON.stringify(hidden),visibilityState.revision]);
  let visibilityPublic=(await as('anon',null,'select public.get_site_public_config() as data')).rows[0].data;
  assert.notEqual(visibilityPublic.config.studio.visibility?.animations,false,'Draft visibility must not affect users');
  await call('admin','select public.save_site_config($1::jsonb,$2,true)',[JSON.stringify(hidden),visibilityState.revision+1]);
  visibilityPublic=(await as('anon',null,'select public.get_site_public_config() as data')).rows[0].data;
  assert.equal(visibilityPublic.config.studio.visibility.animations,false);
  hidden.studio.visibility.animations=true;
  await call('admin','select public.save_site_config($1::jsonb,$2,true)',[JSON.stringify(hidden),visibilityState.revision+2]);
  assert.equal((await as('anon',null,'select public.get_site_public_config() as data')).rows[0].data.config.studio.visibility.animations,true);
 }finally{await db.close();}
});
