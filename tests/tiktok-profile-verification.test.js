import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import vm from 'node:vm';
import {PGlite} from '@electric-sql/pglite';
import {normalizeTikTokUsername,parseTikTokProfile,fetchTikTokProfile,createVerificationHandler} from '../supabase/functions/verify-tiktok-profile/index.ts';

const account = {id:'123456789',uniqueId:'real.creator',nickname:'Real creator',avatarLarger:'https://example.invalid/photo.webp'};
const html = user => `<script id="__UNIVERSAL_DATA_FOR_REHYDRATION__" type="application/json">${JSON.stringify({__DEFAULT_SCOPE__:{'webapp.user-detail':{statusCode:0,userInfo:{user}}}})}</script>`;
const json = (data,status=200) => new Response(JSON.stringify(data),{status,headers:{'Content-Type':'application/json'}});

test('TikTok existence requires structured matching identity, never HTML status, metadata, captcha or another account',async()=>{
    assert.equal(normalizeTikTokUsername(' @Real.Creator '),'real.creator');
    for(const value of ['','@numele_tau','foo/../bar','foo.','https://tiktok.com/@user']) assert.throws(()=>normalizeTikTokUsername(value),/INVALID_USERNAME/);
    assert.equal(parseTikTokProfile(html(account),'real.creator').displayName,'Real creator');
    const sigi = `<script type="application/json" id="SIGI_STATE">${JSON.stringify({UserModule:{users:{123:account}}})}</script>`;
    assert.equal(parseTikTokProfile(sigi,'real.creator').username,'real.creator');
    for(const body of ['<title>@real.creator</title>','<html>Captcha</html>',html({...account,uniqueId:'other.creator'}),html({...account,id:''}),'<script id="SIGI_STATE">{broken}</script>']) assert.throws(()=>parseTikTokProfile(body,'real.creator'),/PROFILE_NOT_VERIFIED/);
    assert.equal(parseTikTokProfile(html({...account,privateAccount:true,avatarLarger:'javascript:alert(1)'}),'real.creator').avatarUrl,null);
    await assert.rejects(fetchTikTokProfile('real.creator',async()=>new Response('',{status:404})),/PROFILE_NOT_FOUND/);
    await assert.rejects(fetchTikTokProfile('real.creator',async()=>new Response('captcha',{status:200})),/PROFILE_NOT_VERIFIED/);
    assert.equal((await fetchTikTokProfile('real.creator',async()=>new Response(html(account)))).username,'real.creator');
});

test('verification endpoint authenticates the caller and confirms only server-fetched TikTok profiles',async()=>{
    let source=html(account),authStatus=200,allowed=true,confirmations=[],limited=false;
    const calls=[];
    const handler=createVerificationHandler({url:'https://db.invalid',anonKey:'public-test',serviceKey:'server-only-test',async fetchImpl(url,options){
        calls.push({url,options});
        if(url.endsWith('/auth/v1/user'))return json({id:'owner-a'},authStatus);
        if(url.endsWith('/get_my_account_status'))return json({allowed});
        if(url.endsWith('/begin_tiktok_profile_verification'))return limited?json({message:'RATE_LIMITED'},400):json(null);
        if(url.startsWith('https://www.tiktok.com/@'))return new Response(source);
        if(url.endsWith('/confirm_tiktok_profile')){confirmations.push(JSON.parse(options.body));return json(null);}
        throw Error('Unexpected URL');
    }});
    const request=(body={username:'real.creator'},origin='https://tikinteract.vercel.app',token='user-token')=>new Request('https://edge.invalid',{method:'POST',headers:{Origin:origin,Authorization:`Bearer ${token}`},body:JSON.stringify(body)});
    const response=await handler(request({username:'real.creator',userId:'victim',displayName:'spoof'}));
    assert.equal(response.status,200);assert.equal((await response.json()).verified,true);
    assert.equal(confirmations[0].p_user_id,'owner-a');assert.equal(confirmations[0].p_display_name,'Real creator');
    assert.equal(calls.find(c=>c.url.startsWith('https://www.tiktok.com/')).options.headers.Authorization,undefined);
    confirmations=[];source='<html>200 OK captcha</html>';
    assert.equal((await handler(request())).status,503);assert.equal(confirmations.length,0);
    authStatus=401;assert.equal((await handler(request())).status,401);
    authStatus=200;allowed=false;assert.equal((await handler(request())).status,403);
    allowed=true;limited=true;assert.equal((await handler(request())).status,429);
    assert.equal((await handler(request({},'https://evil.invalid'))).status,403);
    assert.equal((await handler(request({username:'numele_tau'}))).status,400);
});

test('PostgreSQL rejects unverified usernames, forged confirmation, stale receipts and receipt reuse by another account',async()=>{
    const db=new PGlite(),a='10000000-0000-0000-0000-000000000001',b='10000000-0000-0000-0000-000000000002';
    try {
        await db.exec(`create role anon;create role authenticated;create role service_role;create schema auth;
            create table auth.users(id uuid primary key);insert into auth.users values('${a}'),('${b}');
            create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;
            grant usage on schema auth to anon,authenticated;grant execute on function auth.uid() to anon,authenticated;`);
        const base=await readFile(new URL('../supabase/leaderboard.sql',import.meta.url),'utf8');
        const migration=await readFile(new URL('../supabase/tiktok_profile_verification.sql',import.meta.url),'utf8');
        const legacyBase=base.replace(/ if to_regprocedure\('public.require_verified_tiktok_profile\(uuid,text\)'\) is not null then[\s\S]*? end if;\r?\n/g,'').replace(/    v_verified jsonb;\r?\n/,'');
        assert(!legacyBase.includes('require_verified_tiktok_profile'));
        await db.exec(legacyBase);
        const rpc=async(role,id,expression,args=[])=>{
            await db.exec(`set role ${role}`);await db.query("select set_config('request.jwt.claim.sub',$1,false)",[id||'']);
            try{return(await db.query(`select public.${expression} as value`,args)).rows[0]?.value;}finally{await db.exec('reset role');}
        };
        await rpc('authenticated',a,"save_my_streamer_profile('numele_tau','Example',null,true)");
        await db.exec(migration);await db.exec(migration);
        assert.equal((await db.query("select is_public from public.streamer_profiles where tiktok_username='numele_tau'")).rows[0].is_public,false);
        await assert.rejects(rpc('authenticated',a,"save_my_streamer_profile('invented','Fake',null,true)"),/TIKTOK_PROFILE_NOT_VERIFIED/);
        await assert.rejects(rpc('authenticated',a,"confirm_tiktok_profile($1,'real.creator','Forged',null)",[a]),/permission denied/);
        await assert.rejects(rpc('authenticated',a,"require_verified_tiktok_profile($1,'real.creator')",[a]),/permission denied/);
        await db.exec('set role authenticated');await assert.rejects(db.query('select * from public.tiktok_profile_verifications'),/permission denied/);await db.exec('reset role');
        await rpc('service_role',null,"begin_tiktok_profile_verification($1)",[a]);
        await assert.rejects(rpc('service_role',null,"begin_tiktok_profile_verification($1)",[a]),/RATE_LIMITED/);
        await rpc('service_role',null,"confirm_tiktok_profile($1,'real.creator','Real creator','https://example.invalid/real.webp')",[a]);
        await assert.rejects(rpc('authenticated',b,"save_my_streamer_profile('real.creator','Other user',null,true)"),/TIKTOK_PROFILE_NOT_VERIFIED/);
        await rpc('authenticated',a,"save_my_streamer_profile('@REAL.CREATOR','Forged name','https://example.invalid/fake.webp',true)");
        let row=(await db.query('select * from public.streamer_profiles where user_id=$1',[a])).rows[0];
        assert.equal(row.tiktok_username,'real.creator');assert.equal(row.tiktok_display_name,'Real creator');assert.equal(row.avatar_url,'https://example.invalid/real.webp');
        await rpc('authenticated',a,"start_my_live_session('real.creator')");
        await db.exec(`create function public.is_site_account_allowed(uuid) returns boolean language sql stable as $$select false$$`);
        await assert.rejects(rpc('service_role',null,"confirm_tiktok_profile($1,'real.creator','Blocked',null)",[a]),/ACCOUNT_UNAVAILABLE/);
        await assert.rejects(rpc('service_role',null,"begin_tiktok_profile_verification($1)",[a]),/ACCOUNT_UNAVAILABLE/);
        await assert.rejects(rpc('authenticated',a,"save_my_streamer_profile('real.creator','Blocked',null,true)"),/ACCOUNT_UNAVAILABLE/);
        await db.exec('drop function public.is_site_account_allowed(uuid)');
        await db.exec("update public.tiktok_profile_verifications set verified_at=now()-interval '11 minutes'");
        await assert.rejects(rpc('authenticated',a,"save_my_streamer_profile('real.creator','Expired',null,true)"),/TIKTOK_PROFILE_NOT_VERIFIED/);
        await assert.rejects(rpc('authenticated',a,"start_my_live_session('real.creator')"),/TIKTOK_PROFILE_NOT_VERIFIED/);
        // Reinstalling the base SQL must preserve verification enforcement.
        await db.exec(base);
        await assert.rejects(rpc('authenticated',a,"save_my_streamer_profile('invented','Fake',null,true)"),/TIKTOK_PROFILE_NOT_VERIFIED/);
        await db.exec(migration);
        await db.query('delete from auth.users where id=$1',[a]);
        assert.equal((await db.query('select count(*)::int as total from public.tiktok_profile_verifications')).rows[0].total,0);
    } finally {await db.close();}
});

test('browser verification rejects unavailable services, coalesces checks and discards results after sign-out',async()=>{
    const source=await readFile(new URL('../assets/tiktok-profile.js',import.meta.url),'utf8');
    let calls=0,release,delayed=false;
    const listeners=new Map();
    const window={tikInteractUser:{id:'owner-a'},addEventListener(name,fn){listeners.set(name,fn);},tikInteractSupabase:{functions:{async invoke(){calls++;if(delayed)return new Promise(r=>{release=r;});return{data:{verified:true,profile:{username:'real.creator',displayName:'Real'}}};}}}};
    const context={window,Date,Map,Error};vm.createContext(context);vm.runInContext(source,context);
    const verify=window.TikInteractTikTokProfile.verify;
    await assert.rejects(verify('numele_tau'),/username TikTok real/);assert.equal(calls,0);
    await Promise.all([verify('real.creator'),verify('@REAL.CREATOR')]);assert.equal(calls,1);
    await verify('real.creator');assert.equal(calls,1);
    window.TikInteractTikTokProfile.reset();delayed=true;
    const pending=verify('real.creator');window.tikInteractUser=null;listeners.get('tikinteract:auth')();
    release({data:{verified:true,profile:{username:'real.creator'}}});await assert.rejects(pending,/Contul s-a schimbat/);
    window.tikInteractUser={id:'owner-b'};window.tikInteractSupabase.functions.invoke=async()=>({data:{code:'PROFILE_NOT_FOUND'},error:new Error('failed')});
    await assert.rejects(verify('real.creator'),/nu a fost găsit/);
});
