// Capture the real game renderer in an isolated headless Chrome profile.
import {spawn} from 'node:child_process';
import {readFile, writeFile, mkdir} from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import WebSocket from 'ws';
import {installQAAuth} from './qa-auth-fixture.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const output = path.join(root, '.tools/site-template');
const profile = path.join(root, '.tools/site-template-qa-chrome');
await mkdir(output, {recursive: true});
await mkdir(profile, {recursive: true});
const chrome = process.env.GALLERY_CHROME || 'C:/Program Files/Google/Chrome/Application/chrome.exe';
const processChrome = spawn(chrome, ['--headless=new','--no-first-run','--no-default-browser-check','--disable-background-networking','--disable-component-update','--disable-extensions','--mute-audio','--remote-debugging-port=0',`--user-data-dir=${profile}`,'about:blank'], {windowsHide: true, stdio: ['ignore','ignore','pipe']});
let socket;
try {
    const endpoint = await new Promise((resolve, reject) => {
        let stderr = '';
        const timer = setTimeout(() => reject(new Error('Chrome startup timed out')), 30000);
        processChrome.on('error', reject);
        processChrome.stderr.on('data', chunk => {
            stderr += chunk;
            const match = stderr.match(/DevTools listening on (ws:\/\/[^\s]+)/);
            if (match) {clearTimeout(timer); resolve(match[1]);}
        });
    });
    socket = new WebSocket(endpoint);
    await new Promise((resolve, reject) => {socket.once('open',resolve); socket.once('error',reject);});
    let sequence = 0;
    const pending = new Map();
    socket.on('message', buffer => {
        const message = JSON.parse(buffer.toString());
        if (message.method==='Runtime.exceptionThrown') console.error(message.params.exceptionDetails.exception?.description || message.params.exceptionDetails.text);
        if (!pending.has(message.id)) return;
        const {resolve,reject,timer} = pending.get(message.id);
        pending.delete(message.id); clearTimeout(timer);
        if (message.error) reject(new Error(JSON.stringify(message.error))); else resolve(message.result);
    });
    const send = (method, params = {}, sessionId) => new Promise((resolve,reject) => {
        const id = ++sequence;
        const timer = setTimeout(() => {pending.delete(id);reject(new Error(`Timed out: ${method}`));},30000);
        pending.set(id,{resolve,reject,timer});
        socket.send(JSON.stringify({id,method,params,...(sessionId ? {sessionId} : {})}));
    });
    const {targetId} = await send('Target.createTarget',{url:'about:blank'});
    const {sessionId} = await send('Target.attachToTarget',{targetId,flatten:true});
    const page = (method,params) => send(method,params,sessionId);
    const evaluate = async expression => {
        const result = await page('Runtime.evaluate',{expression,awaitPromise:true,returnByValue:true});
        if (result.exceptionDetails) throw new Error(JSON.stringify(result.exceptionDetails));
        return result.result.value;
    };
    await page('Page.enable');
    await page('Runtime.enable');
    const avatarFixture=(await readFile(path.join(root,'assets/tikinteract-icon-v2.png'))).toString('base64');
    socket.on('message',async raw=>{
        const message=JSON.parse(raw);
        if(message.method==='Fetch.requestPaused'&&message.sessionId===sessionId){
            await page('Fetch.fulfillRequest',{requestId:message.params.requestId,responseCode:200,responseHeaders:[{name:'Content-Type',value:'image/png'}],body:avatarFixture});
        }
    });
    await page('Fetch.enable',{patterns:[{urlPattern:'https://layout.invalid/avatar.png',requestStage:'Request'}]});
    await page('Page.addScriptToEvaluateOnNewDocument',{source:'('+installQAAuth.toString()+')(true)'});
    await page('Emulation.setDeviceMetricsOverride',{width:540,height:960,deviceScaleFactor:2,mobile:false});

    const waitFor=async expression=>{for(let i=0;i<150;i++){try{if(await evaluate(expression))return;}catch{}await new Promise(r=>setTimeout(r,100));}throw new Error('Timed out: '+expression);};
    const settle=(ms=400)=>new Promise(r=>setTimeout(r,ms));
    const assert=async(expression,message)=>{if(!await evaluate(expression))throw new Error(message);};

    const capture=async name=>{
        const shot=await page('Page.captureScreenshot',{format:'webp',quality:90});
        await writeFile(path.join(output,name+'.webp'),Buffer.from(shot.data,'base64'));
    };
    const verifyAccountMenu=async()=>{
        await evaluate("setStreamerProfile('layouttest','https://layout.invalid/avatar.png','TEST avatar')");
        await waitFor("document.getElementById('header-account-avatar-image').naturalWidth>0 && !document.getElementById('header-account-avatar-image').classList.contains('hidden')");
        await assert("!document.getElementById('header-account-avatar').classList.contains('hidden') && document.getElementById('header-account-avatar').getBoundingClientRect().right<=document.getElementById('account-menu-toggle').getBoundingClientRect().left",'Profile photo must appear before the account gear, including on the public page without Studio DOM');
        await assert("getComputedStyle(document.getElementById('account-status-indicator')).display==='none' || document.getElementById('account-status-indicator').getBoundingClientRect().right<=document.getElementById('header-account-avatar').getBoundingClientRect().left",'Profile photo must sit beside the green account indicator');
        await assert("getComputedStyle(document.getElementById('account-menu-toggle')).display!=='none' && document.getElementById('account-menu-toggle').getBoundingClientRect().width>=36 && getComputedStyle(document.getElementById('user-profile-menu')).display==='none'",'Signed-in account must use the gear with a closed dropdown');
        await evaluate("document.getElementById('account-menu-toggle').click()");
        await assert("getComputedStyle(document.getElementById('user-profile-menu')).display==='flex' && document.getElementById('account-menu-toggle').getAttribute('aria-expanded')==='true' && document.getElementById('user-profile-menu').getBoundingClientRect().right<=innerWidth && document.getElementById('user-profile-menu').getBoundingClientRect().left>=0",'Gear must open an account menu inside the viewport');
        await capture('account-menu-'+(await evaluate("document.body.dataset.page || 'site'"))+'-'+(await evaluate('innerWidth')));
        await evaluate("document.dispatchEvent(new KeyboardEvent('keydown',{key:'Escape',bubbles:true}))");
        await assert("getComputedStyle(document.getElementById('user-profile-menu')).display==='none' && document.getElementById('account-menu-toggle').getAttribute('aria-expanded')==='false'",'Escape must close the account dropdown');
    };
    const widths = process.env.QA_WIDTHS ? process.env.QA_WIDTHS.split(',').map(Number) : [1440,390];
    for(const width of widths){
        await page('Emulation.setDeviceMetricsOverride',{width,height:width<768?844:1000,deviceScaleFactor:1,mobile:width<768});
        await page('Page.navigate',{url:'http://localhost:3000/'});
        await waitFor("document.querySelector('[data-home-showcase] canvas') && typeof switchView==='function'");
        await evaluate('document.fonts.ready');await settle(1200);
        await evaluate('__qaSignOut()');
        await assert("[...document.querySelectorAll('[data-requires-account]')].every(element=>element.hidden && getComputedStyle(element).display==='none')",'Studio entries must be hidden for visitors');
        await evaluate("checkAccessAndGo('live')");
        await assert("location.pathname==='/' && !document.getElementById('auth-modal').classList.contains('hidden')",'Visitors must authenticate before Studio navigation');
        await evaluate("closeAuthModal();shouldOpenLiveFromUrl=false;__qaSignIn()");
        await assert("[...document.querySelectorAll('[data-requires-account]')].every(element=>!element.hidden)",'Studio entries must appear after sign-in');
        await verifyAccountMenu();
        await evaluate("document.getElementById('account-menu-toggle').click();document.querySelector('#user-profile-menu .account-menu-button').click()");
        await assert("!document.getElementById('view-account').classList.contains('hidden') && !document.getElementById('user-profile-menu').classList.contains('is-open')",'Account dropdown must open the account page and close itself');
        await evaluate("switchView('home')");
        await assert("document.documentElement.scrollWidth<=innerWidth",'Homepage overflow at '+width);
        await assert("!document.getElementById('live-game-frame') && document.querySelectorAll('.template-navigation [data-nav-item]').length===5 && document.querySelectorAll('.template-navigation [data-nav-item]>i').length===5 && document.querySelector('.hero-app-link').getAttribute('href')==='#download-app' && document.getElementById('download-app-button').disabled",'Homepage must have five icon navigation items and separate Studio from the future app download');
        const before=await evaluate("document.querySelector('[data-showcase-canvas]').toDataURL()");await settle(400);
        if(before===await evaluate("document.querySelector('[data-showcase-canvas]').toDataURL()"))throw new Error('The approved homepage animation must keep running');
        await capture('home-'+width);
        await evaluate("document.querySelector('[data-home-gifts]').scrollIntoView({block:'center',behavior:'instant'});document.activeElement.blur()");
        await waitFor("document.querySelector('[data-gifts-featured] img')?.naturalWidth>0 && document.querySelector('.home-gifts-showcase').classList.contains('is-running')");
        await assert("document.documentElement.scrollWidth<=innerWidth && document.querySelectorAll('[data-gifts-picks] button').length===6 && document.querySelector('[data-gifts-featured] h3').textContent==='Rose'",'Home gifts must show original images and six selections without overflow');
        await settle(600);await capture('home-gifts-'+width);
        await waitFor("document.querySelector('[data-gifts-featured] h3').textContent!=='Rose'");
        await evaluate("document.querySelector('[data-gifts-play]').click()");
        const pausedGift=await evaluate("document.querySelector('[data-gifts-featured] h3').textContent");await settle(4200);
        await assert("document.querySelector('[data-gifts-play]').getAttribute('aria-pressed')==='true' && !document.querySelector('.home-gifts-showcase').classList.contains('is-running') && document.querySelector('[data-gifts-featured] h3').textContent==="+JSON.stringify(pausedGift),'Gift presentation must pause');
        await evaluate("document.querySelectorAll('[data-gifts-picks] button')[4].click()");
        await waitFor("document.querySelector('[data-gifts-featured] h3').textContent==='Galaxy' && document.querySelector('[data-gifts-featured] img').naturalWidth>0");
        await evaluate("document.querySelector('[data-gifts-browse]').click()");
        await waitFor("document.querySelector('.home-gift-catalog').open && document.querySelector('.home-gift-catalog-card img').naturalWidth>0");
        await assert("document.querySelector('.home-gift-catalog-grid').children.length===48 && document.querySelector('.home-gift-catalog-count').textContent.includes('792') && document.querySelector('.home-gift-catalog').scrollWidth<=document.querySelector('.home-gift-catalog').clientWidth",'Public gift catalog must paginate the original catalog within the viewport');
        await capture('home-gift-catalog-'+width);
        await evaluate("document.querySelector('.home-gift-catalog-more').click()");
        await assert("document.querySelector('.home-gift-catalog-grid').children.length===96",'Gift catalog must reveal another page');
        await evaluate("document.querySelector('.home-gift-catalog input').value='5655';document.querySelector('.home-gift-catalog input').dispatchEvent(new Event('input',{bubbles:true}))");
        await assert("document.querySelector('.home-gift-catalog-grid').children.length===1 && document.querySelector('.home-gift-catalog-card h3').textContent==='Rose' && document.querySelector('.home-gift-catalog-more').hidden",'Catalog search must find the original Rose by ID');
        await evaluate("document.querySelector('.home-gift-catalog input').value='no-such-gift-qa';document.querySelector('.home-gift-catalog input').dispatchEvent(new Event('input',{bubbles:true}))");
        await assert("!document.querySelector('.home-gift-catalog-empty').hidden && !document.querySelector('.home-gift-catalog-grid').children.length",'Catalog must explain empty search results');
        await page('Input.dispatchKeyEvent',{type:'keyDown',key:'Escape',code:'Escape',windowsVirtualKeyCode:27});
        await page('Input.dispatchKeyEvent',{type:'keyUp',key:'Escape',code:'Escape',windowsVirtualKeyCode:27});
        await settle(150);
        await assert("!document.querySelector('.home-gift-catalog').open && document.body.style.overflow!=='hidden' && document.activeElement===document.querySelector('[data-gifts-browse]')",'Escape must close the catalog and restore focus/scroll');
        await page('Emulation.setEmulatedMedia',{features:[{name:'prefers-reduced-motion',value:'reduce'}]});await settle(50);
        await assert("!document.querySelector('.home-gifts-showcase').classList.contains('is-running') && document.querySelector('[data-gifts-play]').getAttribute('aria-pressed')==='true'",'Gift animation must respect reduced motion');
        await page('Emulation.setEmulatedMedia',{features:[]});
        await evaluate("document.getElementById('download-app').scrollIntoView({block:'center',behavior:'instant'})");await settle(300);await capture('download-'+width);
        await evaluate("switchView('catalog')");await settle(350);
        await assert("!document.getElementById('view-catalog').classList.contains('hidden') && document.documentElement.scrollWidth<=innerWidth",'Catalog route/layout failed');await capture('catalog-'+width);
        await evaluate("goToPlayPass()");await assert("!document.getElementById('view-play-pass').classList.contains('hidden') && document.documentElement.scrollWidth<=innerWidth",'Play Pass route/layout failed');
        await evaluate("switchView('home');checkAccessAndGo('live')");
        await waitFor("location.pathname==='/live-studio.html' && typeof loadLiveGame==='function'");
        await settle(700);await evaluate("closeAuthModal()");
        await verifyAccountMenu();
        await assert("!document.getElementById('live-game-frame').getAttribute('src') && !document.getElementById('live-game-frame').dataset.gameId && document.getElementById('live-game-frame').hidden && !document.getElementById('studio-game-empty').hidden && document.getElementById('live-game-select').value===''",'Studio must open without any selected or loaded game');
        await assert("!performance.getEntriesByType('resource').some(entry=>/\\/GAME\\/.+\\.html/.test(entry.name))",'Entering Studio must not request a game document');
        await capture('studio-empty-'+width);
        await evaluate("for(const game of ['neon-race-2','moto-interact'])if(!favoriteGameIds.has(game))toggleGameFavorite(game);for(const sound of ['sound-01','sound-02','sound-03','sound-04'])if(!favoriteSoundIds.has(sound))toggleSoundFavorite(sound)");
        await assert("document.querySelectorAll('.studio-game-option').length>=2 && document.getElementById('live-favorites-count').textContent==='4'",'Quick game/audio favorites must work in the new shell');
        await assert("!document.getElementById('live-game-frame').getAttribute('src') && !document.querySelector('.studio-game-option.is-active')",'Adding favorites must not select or start a game');
        await evaluate("document.querySelector('#studio-game-empty button').click();document.querySelector('[data-game-center-card][data-game-id=\"neon-race-2\"] .game-center-card-body button').click()");
        await waitFor("document.getElementById('live-game-frame').dataset.gameId==='neon-race-2' && document.querySelector('[data-test-control=pause]')");
        await assert("!document.getElementById('live-game-frame').hidden && document.getElementById('studio-game-empty').hidden",'Choosing a game must replace the empty arena');
        await evaluate("document.querySelector('[data-test-control=pause]').click()");await settle(150);
        await assert("document.getElementById('live-game-frame').contentDocument.getElementById('raceOverlay').hidden===false",'Standalone Studio external pause must control the game');
        await evaluate("document.querySelector('[data-test-control=pause]').click()");
        await assert("document.documentElement.scrollWidth<=innerWidth && !document.getElementById('view-home')",'Standalone Studio overflow/content separation failed');
        await capture('studio-'+width);
        await evaluate("setLiveStudioTab('games')");await settle(300);
        await assert("!document.getElementById('game-center-panel').classList.contains('hidden') && document.documentElement.scrollWidth<=innerWidth",'Game Center failed');
        await capture('games-'+width);
        await evaluate("launchStudioGame('moto-interact')");
        await waitFor("document.getElementById('studio-test-game-name')?.textContent==='Moto Interact' && document.getElementById('studio-test-panel').getAttribute('aria-busy')==='false'");
        await assert("document.getElementById('live-game-frame').dataset.gameId==='moto-interact'",'Game selection failed');
        await evaluate("setLiveStudioTab('audio')");await settle(250);
        await assert("!document.getElementById('audio-center-panel').classList.contains('hidden') && document.documentElement.scrollWidth<=innerWidth",'Audio Center failed');await capture('audio-'+width);
        await assert("document.getElementById('live-game-frame').dataset.gameId==='moto-interact'",'Opening Audio Center must keep the selected game');
        await evaluate("returnToLiveStudio();openStudioHelp()");await settle(100);
        await assert("document.getElementById('studio-help-dialog').open && document.getElementById('studio-tour-title').textContent.length>0",'Studio tutorial failed');
        await evaluate("closeStudioHelp()");
        await evaluate('__qaSignOut();closeAuthModal()');
        await assert("document.body.classList.contains('studio-locked') && !document.getElementById('studio-access-gate').hidden && getComputedStyle(document.querySelector('.app-main')).display==='none' && !document.getElementById('live-game-frame').getAttribute('src') && document.getElementById('header-account-avatar').classList.contains('hidden')",'Signing out must hide Studio, unload the game and clear the profile photo');
        await assert("loadLiveGame('moto-interact')===false && !document.getElementById('live-game-frame').getAttribute('src')",'Signed-out visitors cannot launch a game programmatically');
        await page('Page.reload');await waitFor("typeof loadLiveGame==='function' && window.tikInteractSupabase");await settle(200);
        await evaluate('closeAuthModal()');
        await assert("document.body.classList.contains('studio-locked') && !document.getElementById('studio-access-gate').hidden && __qaSockets.length===0 && !performance.getEntriesByType('resource').some(entry=>/\\/GAME\\/.+\\.html/.test(entry.name))",'Direct signed-out Studio access must stay locked without a game or local connection');
        await capture('studio-locked-'+width);
        await evaluate('__qaSignIn()');
        await assert("!document.body.classList.contains('studio-locked') && document.getElementById('studio-access-gate').hidden && !document.getElementById('live-game-frame').getAttribute('src')",'Signing in unlocks Studio without automatically selecting a game');
        console.log('Verified website, animation, app section, standalone Studio, games, audio and tutorial at '+width+'px.');
    }
    await page('Emulation.setDeviceMetricsOverride',{width:1366,height:768,deviceScaleFactor:1,mobile:false});
    await page('Page.navigate',{url:'http://localhost:3000/live-studio.html?game=moto-interact'});
    await waitFor("typeof loadLiveGame==='function'");await settle(400);await evaluate('closeAuthModal()');
    await assert("!document.getElementById('live-game-frame').getAttribute('src')",'A game URL must not start the game automatically');
    await evaluate("launchStudioGame('moto-interact')");
    await waitFor("document.getElementById('studio-test-game-name').textContent==='Moto Interact' && document.querySelector('[data-test-control=pause]')");
    await assert("document.getElementById('live-game-frame').getBoundingClientRect().bottom<=innerHeight+1",'Laptop preview must fit on screen');await capture('studio-laptop');
    await page('Page.navigate',{url:'http://localhost:3000/index.html?view=live&game=moto-interact'});
    await waitFor("location.pathname==='/live-studio.html' && typeof loadLiveGame==='function'");
    await assert("!document.getElementById('live-game-frame').getAttribute('src')",'Legacy links must open the empty Studio');
    await evaluate("localStorage.setItem('tikinteract-last-game','moto-interact')");
    await page('Page.reload');await waitFor("typeof loadLiveGame==='function'");
    await assert("!document.getElementById('live-game-frame').getAttribute('src')",'Reloading with a saved game must leave Studio empty');
    await page('Page.navigate',{url:'http://localhost:3000/index.html?view=account'});
    await waitFor("typeof updateUI==='function' && document.getElementById('view-account')");
    // Simulate only the local UI callback; do not sign in or publish a profile.
    await assert("(()=>{restoreMyStreamerProfile=()=>Promise.resolve();updateUI({user:{id:'local-layout-test',email:'layout@example.invalid',user_metadata:{display_name:'Layout test'},app_metadata:{provider:'email'}}});return !document.getElementById('view-account').classList.contains('hidden') && document.getElementById('account-display-name').textContent==='Layout test';})()",'Account return must wait for the auth callback');
    console.log('Verified laptop preview fit and legacy Studio/game deep links. No real TikTok connection opened.');
    await send('Browser.close');
} finally {socket?.close();processChrome.kill();}

