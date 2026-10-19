import {mkdir,writeFile} from 'node:fs/promises';
import {openSkyShiftBrowser} from './skyshift-browser.mjs';

const out='.tools/neon-ascent-qa';await mkdir(out,{recursive:true});
const browser=await openSkyShiftBrowser('neon-ascent-browser-qa');
const {page,evaluate,waitFor}=browser;
const assert=async(expression,message)=>{if(!await evaluate(expression))throw new Error(message);};
try {
    for(const width of [1440,390]) {
        await page('Emulation.setDeviceMetricsOverride',{width,height:width===1440?1000:844,deviceScaleFactor:1,mobile:width<768});
        await page('Page.navigate',{url:(process.env.SKYSHIFT_URL||'http://localhost:3001')+'/GAME/NOVA-VEX/Neon-Ascent.html?qa'});
        await waitFor('!!window.__neonAscent && document.getElementById("loading").hidden');
        await assert("document.documentElement.scrollWidth<=innerWidth && document.documentElement.scrollHeight<=innerHeight",'Game must fit desktop/mobile without scrolling');
        await assert("__neonAscent.renderer.atlas.naturalWidth>0 && __neonAscent.renderer.props.rival.naturalWidth>0 && __neonAscent.renderer.props.board.naturalWidth>0 && Object.values(__neonAscent.renderer.backgrounds).every(image=>image.naturalWidth>0)",'All new art must load');
        await assert("new Set(Object.values(__neonAscent.renderer.backgrounds).map(image=>image.src)).size===8 && __neonAscent.renderer.actionAtlas.naturalWidth>0",'Every height zone must use its own image and the new gift atlas must load');
        await assert("(()=>{const icons=[...document.querySelectorAll('#gift-buttons canvas')];return icons.length===11&&new Set(icons.map(canvas=>canvas.toDataURL())).size===11&&icons.every(canvas=>canvas.getContext('2d').getImageData(0,0,canvas.width,canvas.height).data.some((value,i)=>i%4===3&&value>50));})()",'All eleven new gifts need distinct visible generated icons');
        await assert("document.querySelector('.brand').textContent.includes('TIKINTERACT') && document.querySelector('.game-title').textContent.includes('NOVA & VEX') && document.getElementById('character-colors').children.length===6",'Brand and six human clothing colors must be present');
        await browser.screenshot(out+'/city-'+width+'.webp');
        for(const [zone,meter] of [['abyss',-1200],['crystal',-700],['lava',-200],['earth',0],['grass',150],['clouds',500],['space',1100],['cosmos',2200]]){
            await evaluate("__neonAscent.sim.setSettings({backgroundTheme:'Auto'});__neonAscent.teleport("+meter+");__neonAscent.advance(.7)");
            await assert('__neonAscent.renderer.backgroundKey==='+JSON.stringify(zone),'Automatic height-zone artwork failed for '+zone);
            await browser.screenshot(out+'/zone-'+zone+'-'+width+'.webp');
        }
        await evaluate("__neonAscent.teleport(0)");
        await evaluate("__neonAscent.sim.setSettings({backgroundTheme:'clouds'});__neonAscent.render();__neonAscent.advance(1)");
        await browser.screenshot(out+'/clouds-'+width+'.webp');
        await evaluate("__neonAscent.sim.setSettings({backgroundTheme:'space'});__neonAscent.render();__neonAscent.advance(1)");
        await browser.screenshot(out+'/space-'+width+'.webp');
        await evaluate("__neonAscent.sim.setSettings({backgroundTheme:'lava'});__neonAscent.render();__neonAscent.advance(1)");
        await browser.screenshot(out+'/depths-'+width+'.webp');
        await evaluate("__neonAscent.sim.setSettings({backgroundTheme:'earth'});__neonAscent.control({action:'session.restart'});__neonAscent.render();document.getElementById('menu-toggle').click();document.getElementById('test-toggle').click()");
        await assert("!document.getElementById('game-menu').hidden && !document.getElementById('test-panel').hidden && document.getElementById('game-menu').scrollWidth<=document.getElementById('game-menu').clientWidth",'Test menu must open and fit mobile width');
        await browser.screenshot(out+'/test-menu-'+width+'.webp');
        await evaluate("document.getElementById('gift-quantity').value='2';document.querySelector('[data-action=rocket]').click()");
        await waitFor('__neonAscent.sim.ledger.accepted===1');
        await evaluate("document.getElementById('menu-close').click();__neonAscent.advance(1)");
        await assert("__neonAscent.sim.active?.kind==='rocket' && __neonAscent.sim.distance>0 && __neonAscent.sim.ledger.requestedMeters===600",'Gift menu must apply quantity and start an upward rocket effect');
        await browser.screenshot(out+'/gift-rocket-'+width+'.webp');
        await evaluate('__neonAscent.advance(8)');
        await assert('__neonAscent.sim.ledger.appliedMeters===600','Upward gift must apply its full distance');
        await evaluate("__neonAscent.action({action:'meteor',amount:1,commandId:'meteor-qa',actor:{username:'preview'}});__neonAscent.advance(1)");
        await browser.screenshot(out+'/gift-meteor-'+width+'.webp');
        await evaluate('__neonAscent.advance(8)');
        await assert('__neonAscent.sim.ledger.appliedMeters===450 && __neonAscent.sim.ledger.completedCommands===2','Downward gift must subtract distance and complete');
        await evaluate("__neonAscent.control({action:'session.restart'});__neonAscent.sim.setSettings({backgroundTheme:'space'});__neonAscent.action({action:'winRemove',amount:1,commandId:'rival-qa',actor:{username:'preview'}});__neonAscent.render();__neonAscent.advance(2.6)");
        await assert("__neonAscent.renderer.scoreMoment?.kind==='theft' && __neonAscent.sim.wins===-1",'Rival scene must still play for a stolen win');
        await browser.screenshot(out+'/rival-'+width+'.webp');
        await evaluate('__neonAscent.advance(5)');
        await assert('__neonAscent.sim.presentationErrors===0 && !__neonAscent.renderer.scoreMoment','Rival scene must finish without render errors');
        await evaluate("__neonAscent.control({action:'session.pause'});__neonAscent.render()");
        await assert("!document.getElementById('status').hidden && __neonAscent.sim.paused",'Pause overlay must remain functional');
        await browser.screenshot(out+'/pause-'+width+'.webp');
        await evaluate("__neonAscent.control({action:'session.resume'});document.getElementById('menu-toggle').click();document.getElementById('setup-toggle').click()");
        for(const skin of ['Cyan','Mint','Violet','Rose','Amber','Red']) {
            await evaluate('document.querySelector(\'[data-color="'+skin+'"]\').click();__neonAscent.render()');
            await assert('__neonAscent.sim.settings.characterColor==='+JSON.stringify(skin),'Skin selection must update the human outfit');
        }
        await assert("(()=>{const r=__neonAscent.renderer,s=r.sprites.idle,c=document.createElement('canvas');c.width=s.w;c.height=s.h;const ctx=c.getContext('2d');ctx.drawImage(r.atlas,s.x,s.y,s.w,s.h,0,0,s.w,s.h);const a=ctx.getImageData(0,0,s.w,s.h).data,b=r.colorCache.get('Violet').idle.getContext('2d').getImageData(0,0,s.w,s.h).data;let warm=0;for(let at=0;at<a.length;at+=4){if(a[at+3]<250||a[at]<a[at+1]*1.2||a[at]<a[at+2]*1.2)continue;warm++;if(Math.max(Math.abs(a[at]-b[at]),Math.abs(a[at+1]-b[at+1]),Math.abs(a[at+2]-b[at+2]))>2)return false;}return warm>150;})()",'Clothing recolors must preserve the human skin tones');
        await browser.screenshot(out+'/settings-'+width+'.webp');
        await evaluate("document.getElementById('menu-close').click();__neonAscent.sim.setSettings({finishDistance:10,winCountdown:3,backgroundTheme:'clouds',characterColor:'Cyan'});__neonAscent.control({action:'session.restart'});__neonAscent.action({action:'rocket',amount:1,actor:{username:'preview'}});__neonAscent.render();__neonAscent.advance(3.5)");
        await assert("__neonAscent.sim.phase==='holding' && !document.getElementById('finish-card').hidden && Number(document.getElementById('countdown').textContent)>0",'Finish must show the original countdown');
        await browser.screenshot(out+'/finish-'+width+'.webp');
        await evaluate('__neonAscent.advance(5)');
        await assert('__neonAscent.sim.wins===0 && __neonAscent.sim.presentationErrors===0','Completing the finish must award one win after the previous rival theft');
        await evaluate("__neonAscent.control({action:'session.panic'});__neonAscent.sim.setSettings({finishDistance:10000});__neonAscent.control({action:'session.restart'});__neonAscent.control({action:'session.resume'});document.querySelector('[data-quick-action=cloud]').click()");
        await waitFor("__neonAscent.sim.active?.kind==='cloud'");
        await evaluate('__neonAscent.advance(5)');
        await assert('__neonAscent.sim.presentationErrors===0','Quick preview must use the real action route without errors');
        for(const [action,delta] of [['balloon',5],['anvil',-5],['magnet',50],['cloud',150],['rocket',300],['wind',-50],['vortex',-300],['meteor',-150],['reset',0],['winAdd',0],['winRemove',0]]){
            await evaluate("__neonAscent.control({action:'session.panic'});__neonAscent.control({action:'session.resume'});__neonAscent.sim.setSettings({backgroundTheme:'earth'});__neonAscent.teleport(500);__neonAscent.renderer.moment=null;__neonAscent.render()");
            const baseline=await evaluate('({meters:__neonAscent.sim.ledger.appliedMeters,wins:__neonAscent.sim.wins})');
            await evaluate('__neonAscent.action({action:'+JSON.stringify(action)+',amount:1,commandId:'+JSON.stringify('new-gift-'+action)+",actor:{username:'giftpreview'},simulated:true});__neonAscent.render();__neonAscent.advance(.6)");
            await browser.screenshot(out+'/new-gift-'+action+'-'+width+'.webp');
            await evaluate('__neonAscent.advance(8)');
            await assert('__neonAscent.sim.presentationErrors===0 && !__neonAscent.sim.active && __neonAscent.sim.ledger.appliedMeters==='+JSON.stringify(baseline.meters+delta),'Gift must finish and apply its full distance: '+action);
            if(action==='winAdd'||action==='winRemove')await assert('__neonAscent.sim.wins==='+JSON.stringify(baseline.wins+(action==='winAdd'?1:-1)),'Crown gift must change the score: '+action);
            await assert('__neonAscent.action({action:'+JSON.stringify(action)+',amount:1,commandId:'+JSON.stringify('new-gift-'+action)+'})===false','Duplicate gift must not be applied twice: '+action);
        }
        console.log('Verified new art, six skins, gift quantity/up/down, rival animation, pause and layout at '+width+'px.');
    }
    await page('Page.navigate',{url:(process.env.SKYSHIFT_URL||'http://localhost:3001')+'/GAME/NOVA-VEX/Neon-Ascent.html'});
    await waitFor('document.getElementById("loading")?.hidden===true');
    const before=await evaluate("document.getElementById('scene').toDataURL()");
    await new Promise(resolve=>setTimeout(resolve,300));
    await assert("document.getElementById('scene').toDataURL()!=="+JSON.stringify(before),'Normal runtime must animate without a QA clock');
    await evaluate("document.querySelector('[data-quick-action=cloud]').click()");
    await waitFor("Number(document.getElementById('distance').textContent.replaceAll('.',''))>0");
    console.log('Verified normal realtime gameplay and the upward preview control without QA hooks.');
    if(browser.errors.length)throw new Error(browser.errors.join('\n'));
    await writeFile(out+'/result.json',JSON.stringify({passed:true,widths:[1440,390],errors:browser.errors},null,2));
} finally {await browser.close();}
