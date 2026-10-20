import test from 'node:test';import assert from 'node:assert/strict';import{readFile}from'node:fs/promises';
import{createAdminQABridge}from'../scripts/qa-admin-database.mjs';

test('creator update upgrades sessions without current_game, preserves history and can run twice',async()=>{
 const bridge=await createAdminQABridge('http://127.0.0.1:3005',{creator:true}),{db,ids}=bridge;
 try{
  await db.exec(`insert into public.streamer_profiles(user_id,tiktok_username,tiktok_display_name,total_coins,total_live_seconds)values('${ids.owner}','legacy.creator','Legacy Creator',37,600);
   insert into public.streamer_live_sessions(user_id,tiktok_username,started_at,ended_at,duration_seconds,total_coins)values('${ids.owner}','legacy.creator',now()-interval '20 minutes',now()-interval '10 minutes',600,37);
   insert into public.streamer_gift_events(event_id,session_id,user_id,coins)select gen_random_uuid(),id,user_id,37 from public.streamer_live_sessions;
   alter table public.streamer_live_sessions drop column current_game cascade;`);
  const before=(await db.query('select id,user_id,tiktok_username,started_at,ended_at,duration_seconds,total_coins from public.streamer_live_sessions')).rows;
  const update=await readFile(new URL('../supabase/creator-update.sql',import.meta.url),'utf8');
  await db.exec(update);await db.exec(update);
  assert.deepEqual((await db.query('select id,user_id,tiktok_username,started_at,ended_at,duration_seconds,total_coins from public.streamer_live_sessions')).rows,before);
  assert.equal((await db.query('select current_game from public.streamer_live_sessions')).rows[0].current_game,'unselected');
  assert.equal((await db.query('select total_coins from public.streamer_profiles')).rows[0].total_coins,37);
  assert.equal((await db.query('select coins from public.streamer_gift_events')).rows[0].coins,37);
  await db.exec(`set request.jwt.claim.sub='${ids.owner}';set role authenticated;`);
  const analytics=(await db.query('select public.get_my_stream_analytics(30,null)data')).rows[0].data;
  assert.equal(analytics.totals.coins,37);assert.equal(analytics.sessions[0].game,'unselected');
  const session=(await db.query("select public.start_my_live_session('legacy.creator','nova-vex')id")).rows[0].id;
  await db.query("select public.update_my_live_game('moto-interact')");
  assert.equal((await db.query('select public.get_my_stream_analytics(30,$1)data',[session])).rows[0].data.sessions[0].game,'moto-interact');
 }finally{await db.exec('reset role');await bridge.close();}
});

test('creator services enforce PRO, private conversations, own analytics and official inbox isolation',async()=>{
 const bridge=await createAdminQABridge('http://127.0.0.1:3005',{creator:true}),{db,ids}=bridge;
 async function as(role,sql,args=[]){await db.exec(`reset role;set request.jwt.claim.sub='${ids[role]||''}';set role ${role==='anon'?'anon':'authenticated'}`);try{return(await db.query(sql,args)).rows;}finally{await db.exec('reset role');}}
 async function grant(user,plan='play_pass_pro'){
  await db.exec(`insert into public.access_keys(batch_id,key_hash,key_hint,plan,months)values(gen_random_uuid(),gen_random_uuid()::text,'test','${plan}',1)`);
  await db.exec(`insert into public.account_access_grants(user_id,source_key,plan,starts_at,ends_at)select '${user}',id,plan,now()-interval '1 day',now()+interval '30 days'from public.access_keys k where not exists(select 1 from public.account_access_grants where source_key=k.id)`);
 }
 try{
  await assert.rejects(as('visitor','select public.community_join()'),/PRO_REQUIRED/);
  await grant(ids.visitor,'play_pass');await assert.rejects(as('visitor','select public.community_join()'),/PRO_REQUIRED/);
  await grant(ids.owner);await grant(ids.editor);await as('owner','select public.community_join()');await as('editor','select public.community_join()');
  const request='20000000-0000-0000-0000-000000000001';
  const sent=await as('owner',"select public.community_send('direct',$1,'Private hello',$2) id",[ids.editor,request]);
  assert.equal((await as('owner',"select public.community_send('direct',$1,'Private hello',$2) id",[ids.editor,request]))[0].id,sent[0].id);
  await assert.rejects(as('owner',"select public.community_send('general',null,'Changed message',$1)",[request]),/CONFLICT/);
  assert.equal((await as('editor',"select public.community_thread('direct',$1,null) data",[ids.owner]))[0].data.items[0].body,'Private hello');
  await grant(ids.visitor);await as('visitor','select public.community_join()');
  assert.equal((await as('visitor',"select public.community_thread('direct',$1,null) data",[ids.owner]))[0].data.items.length,0);
  await assert.rejects(as('visitor','select * from public.community_messages'),/permission denied/);
  await assert.rejects(as('visitor','select public.community_delete($1)',[sent[0].id]),/NOT_ALLOWED/);
  await as('owner','select public.community_delete($1)',[sent[0].id]);
  assert.equal((await as('editor',"select public.community_thread('direct',$1,null)data",[ids.owner]))[0].data.items[0].deleted,true);
  await db.exec(`update public.account_access_grants set revoked_at=now()where user_id='${ids.editor}'`);
  await assert.rejects(as('editor',"select public.community_thread('general',null,null)"),/PRO_REQUIRED/);
  await db.exec(`insert into public.streamer_profiles(user_id,tiktok_username,tiktok_display_name)values('${ids.owner}','qa.creator','QA Creator'),('${ids.visitor}','qa.other','Other Creator')`);
  const session=(await as('owner',"select public.start_my_live_session('qa.creator','nova-vex')id"))[0].id;
  await as('owner','select public.record_my_live_metrics($1,10,40,25,$2)',[session,['viewer_one','viewer_one','viewer_two']]);
  await as('owner','select public.record_my_live_metrics($1,8,30,20,$2)',[session,['viewer_three']]);
  await assert.rejects(as('visitor','select public.record_my_live_metrics($1,1,1,1,$2)',[session,[]]),/SESSION_REQUIRED/);
  await as('owner',"select public.record_my_live_gift_details(gen_random_uuid(),'qa.creator',20,'5655','Rose',null,10,2,'supporter')");
  const analytics=(await as('owner','select public.get_my_stream_analytics(30,null)data'))[0].data;
  assert.equal(analytics.totals.coins,20);assert.equal(analytics.totals.gifts,10);assert.equal(analytics.totals.peakViewers,25);assert.equal(analytics.totals.likes,40);assert.equal(analytics.totals.chatters,3);
  assert.equal(analytics.games[0].id,'nova-vex');assert.equal(analytics.supporters[0].name,'supporter');assert.equal(analytics.daily.reduce((n,d)=>n+d.coins,0),20);
  assert.equal((await as('visitor','select public.get_my_stream_analytics(30,null)data'))[0].data.totals.coins,0);
  await assert.rejects(as('visitor','select public.get_my_stream_analytics(30,$1)',[session]),/NOT_FOUND/);
  const directory=(await as('anon','select public.get_streams_directory()data'))[0].data;assert.equal(directory.stats.live,1);
  await as('owner',"select public.update_my_live_game('moto-interact')");
  assert.equal((await db.query('select count(*)::int n from public.streamer_session_games where session_id=$1',[session])).rows[0].n,2);
  let inbox=(await as('owner','select public.get_my_site_inbox(false,0)data'))[0].data;assert(inbox.items.some(n=>n.kind==='welcome'));assert(inbox.items.some(n=>n.kind==='access'));
  const notice=(await as('owner',"select public.send_site_notification($1,'Un mesaj oficial','Doar pentru tine','Official message','Only for you')id",[ids.visitor]))[0].id;
  assert((await as('visitor','select public.get_my_site_inbox(false,0)data'))[0].data.items.some(n=>n.id===notice));
  assert(!(await as('editor','select public.get_my_site_inbox(false,0)data'))[0].data.items.some(n=>n.id===notice));
  await as('editor','select public.mark_my_site_messages_read($1,false)',[notice]);assert.equal((await db.query('select read_at from public.site_notifications where id=$1',[notice])).rows[0].read_at,null);
  await as('visitor','select public.mark_my_site_messages_read($1,false)',[notice]);assert((await db.query('select read_at from public.site_notifications where id=$1',[notice])).rows[0].read_at);
  await assert.rejects(as('visitor',"select public.send_site_notification($1,'Forged','Should fail',null,null)",[ids.owner]),/ADMIN_REQUIRED/);
 }finally{await bridge.close();}
});
