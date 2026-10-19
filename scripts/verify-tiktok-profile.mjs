import assert from 'node:assert/strict';
import {openSkyShiftBrowser} from './skyshift-browser.mjs';
import {installQAAuth} from './qa-auth-fixture.mjs';

const origin=process.env.MEDIA_ROOT||'http://127.0.0.1:3005';
if(!['localhost','127.0.0.1'].includes(new URL(origin).hostname))throw Error('QA requires localhost.');
const browser=await openSkyShiftBrowser('tiktok-profile-verification-test');
try {
    await browser.page('Page.addScriptToEvaluateOnNewDocument',{source:`
        (${installQAAuth.toString()})(true);
        var qaClient=window.supabase.createClient();
        qaClient.auth.getUser=async()=>({data:{user:{id:'local-layout-test',email:'layout@example.invalid'}},error:null});
        window.__profileChecks=[];window.__profileWrites=[];window.__profileOrder=[];window.__profileMode='missing';window.__profileRelease=null;
        localStorage.removeItem('tikinteract_tiktok_user');
        qaClient.functions={async invoke(name,{body}){
            window.__profileChecks.push(body.username);window.__profileOrder.push('verify:'+body.username);
            if(window.__profileMode==='missing')return{data:{code:'PROFILE_NOT_FOUND'},error:new Error('Missing')};
            if(window.__profileMode==='blocked')return{data:{code:'PROFILE_NOT_VERIFIED'},error:new Error('Blocked')};
            if(window.__profileMode==='delayed')return new Promise(resolve=>window.__profileRelease=()=>resolve({data:{verified:true,profile:{username:body.username,displayName:'Verified '+body.username,avatarUrl:null}}}));
            return{data:{verified:true,profile:{username:body.username,displayName:'Verified '+body.username,avatarUrl:null}}};
        }};
        var previousRPC=qaClient.rpc.bind(qaClient);
        qaClient.rpc=async(name,args)=>{
            if(name==='get_my_account_status')return{data:{allowed:true,state:'active',serverNow:new Date().toISOString()},error:null};
            if(name==='save_my_streamer_profile'){window.__profileWrites.push(args);window.__profileOrder.push('save:'+args.p_tiktok_username);return{data:null,error:null};}
            return previousRPC(name,args);
        };
    `});
    await browser.page('Page.navigate',{url:origin+'/live-studio.html'});
    await browser.waitFor("window.tikInteractUser?.id==='local-layout-test' && window.TikInteractAccount?.isAllowed()===true");
    assert.equal(await browser.evaluate("document.querySelector('#tiktok-user').value"),'');
    assert.equal(await browser.evaluate("!!document.querySelector('#live-game-frame').getAttribute('src')"),false);
    const enter=async username=>browser.evaluate(`document.querySelector('#tiktok-user').value=${JSON.stringify(username)};syncTikTokAccount();true`);
    await enter('@numele_tau');
    await browser.waitFor("document.querySelector('#tiktok-sync-status').textContent.includes('textul de exemplu')");
    assert.equal(await browser.evaluate('__profileChecks.length'),0);
    await enter('@no.such.creator');
    await browser.waitFor("document.querySelector('#tiktok-sync-status').textContent.includes('nu a fost găsit')");
    assert.equal(await browser.evaluate('__profileWrites.length'),0);
    assert.equal(await browser.evaluate("localStorage.getItem('tikinteract_tiktok_user')"),null);
    await browser.evaluate("__profileMode='blocked'");await enter('@real.creator');
    await browser.waitFor("document.querySelector('#tiktok-sync-status').textContent.includes('TikTok nu a confirmat')");
    assert.equal(await browser.evaluate('__profileWrites.length'),0);
    await browser.evaluate("__profileMode='valid'");await enter('@real.creator');
    await browser.waitFor("document.querySelector('#tiktok-sync-status').textContent.includes('verificat și salvat')");
    assert.equal(await browser.evaluate('__profileWrites.length'),1);
    assert.deepEqual(await browser.evaluate('__profileOrder.slice(-2)'),['verify:real.creator','save:real.creator']);
    assert.equal(await browser.evaluate("localStorage.getItem('tikinteract_tiktok_user')"),'@real.creator');
    assert.equal(await browser.evaluate("document.querySelector('#tiktok-profile').classList.contains('hidden')"),false);
    await browser.evaluate("__profileMode='delayed'");await enter('@late.creator');
    await browser.waitFor('!!__profileRelease');
    await browser.evaluate('clearTikTokAccount();__profileRelease();true');
    await browser.waitFor("document.querySelector('#tiktok-user').value===''");
    assert.equal(await browser.evaluate('__profileWrites.length'),1);
    assert.equal(await browser.evaluate("localStorage.getItem('tikinteract_tiktok_user')"),null);
    // A stale earlier request cannot overwrite a newer valid username.
    await enter('@older.creator');await browser.waitFor('!!__profileRelease');
    await browser.evaluate("__profileMode='valid'");await enter('@newer.creator');
    await browser.waitFor('__profileWrites.length===2');
    await browser.evaluate('__profileRelease();true');
    assert.equal(await browser.evaluate('__profileWrites.at(-1).p_tiktok_username'),'newer.creator');
    await browser.evaluate("localStorage.setItem('tikinteract_tiktok_user','@unverified.draft');restoreMyStreamerProfile()");
    assert.equal(await browser.evaluate('__profileWrites.length'),2);
    assert.deepEqual(browser.errors,[]);
    console.log('TikTok profile UI passed: blank default, invalid/missing/blocked names rejected, verify before save, reset cancellation, stale requests and no auto-save from local drafts.');
} catch(error) {
    console.error(await browser.evaluate("({status:document.querySelector('#tiktok-sync-status')?.textContent,checks:window.__profileChecks,writes:window.__profileWrites})"),browser.errors);
    throw error;
} finally {await browser.close();}
