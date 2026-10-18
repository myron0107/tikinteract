// Optional isolated PostgreSQL check; no production connection or credentials.
// npm install --prefix .tools/gifts-db-check --no-save --package-lock=false --ignore-scripts @electric-sql/pglite
import {PGlite} from '../.tools/gifts-db-check/node_modules/@electric-sql/pglite/dist/index.js';
import {readFile} from 'node:fs/promises';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
const db=new PGlite();
try{
    await db.exec(`create role anon;create role authenticated;create schema auth;
      create table auth.users(id uuid primary key);
      create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;`);
    for(const file of ['leaderboard.sql','leaderboard_periods.sql','tiktok_gifts.sql'])await db.exec(await readFile(new URL('../supabase/'+file,import.meta.url),'utf8'));
    const alice=randomUUID(),bob=randomUUID();await db.query('insert into auth.users values($1),($2)',[alice,bob]);
    const login=id=>db.query("select set_config('request.jwt.claim.sub',$1,false)",[id||'']);
    await login(alice);await db.query("select public.save_my_streamer_profile('testalice','Alice',null,true)");await db.query("select public.start_my_live_session('testalice')");
    const send=(id,name='testalice',quantity=1,unit=10,gift='1')=>db.query('select public.record_my_live_gift_details($1,$2,$3,$4,$5,$6,$7,$8,$9) as saved',[id,name,quantity*unit,gift,'Test gift '+gift,'https://example.com/gift.webp',quantity,unit,'Test sender']);
    const one=randomUUID(),ten=randomUUID();assert.equal((await send(one)).rows[0].saved,true);assert.equal((await send(ten,'testalice',10,1)).rows[0].saved,true);
    assert.equal((await send(ten,'testalice',10,1)).rows[0].saved,false);
    const collection=async name=>(await db.query('select public.get_streamer_gift_collection($1) as data',[name])).rows[0].data;
    let data=await collection('testalice');assert.equal(data.count,11);assert.equal(data.coins,20);assert.equal(data.types,1);
    assert.equal(Number((await db.query('select total_coins from public.streamer_profiles where user_id=$1',[alice])).rows[0].total_coins),20);
    const legacy=randomUUID();await db.query('select public.record_my_live_gift($1,20)',[legacy]);await db.query('select public.finish_my_live_session()');
    assert.equal((await send(legacy,'testalice',2,10)).rows[0].saved,true);
    data=await collection('testalice');assert.equal(data.count,13);assert.equal(data.coins,40);
    assert.equal(Number((await db.query('select total_coins from public.streamer_profiles where user_id=$1',[alice])).rows[0].total_coins),40,'Enriching an old event must not add its coins again');
    await db.query("select public.start_my_live_session('testalice')");
    await send(randomUUID(),'testalice',3,1);
    await db.query('select public.finish_my_live_session()');
    data=await collection('testalice');assert.equal(data.count,16,'Received gifts accumulate across LIVE sessions');assert.equal(data.coins,43);
    await login(bob);await db.query("select public.save_my_streamer_profile('testbob','Bob',null,true)");await db.query("select public.start_my_live_session('testbob')");
    await send(randomUUID(),'testbob',1,100,'2');assert.equal((await collection('testbob')).count,1);assert.equal((await collection('testalice')).count,16);
    await assert.rejects(()=>send(randomUUID(),'testalice'),/not linked to your account/);
    await db.query('update public.streamer_profiles set is_public=false where user_id=$1',[alice]);assert.equal(await collection('testalice'),null);
    await login(alice);assert.equal((await collection('testalice')).count,16,'Owner can view their private collection');
    await login(null);await assert.rejects(()=>send(randomUUID()),/Authentication required/);assert.equal(await collection('testalice'),null);
    await db.exec('set role anon');await assert.rejects(()=>db.query('select * from public.streamer_gift_collection_events'),/permission denied/);await db.exec('reset role');
    await db.exec(await readFile(new URL('../supabase/tiktok_gifts.sql',import.meta.url),'utf8'));
    await login(bob);assert.equal((await collection('testbob')).coins,100);
    console.log('Verified gift SQL in isolated PostgreSQL: migration/rerun, real quantities and coin values, deduplication, legacy enrichment after session end, separate streamers, owner checks and public/private access.');
}finally{await db.close();}
