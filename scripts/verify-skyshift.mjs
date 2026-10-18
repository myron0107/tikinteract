import {mkdir,writeFile} from 'node:fs/promises';
import {openSkyShiftBrowser} from './skyshift-browser.mjs';

const out='.tools/skyshift-qa';await mkdir(out,{recursive:true});
const browser=await openSkyShiftBrowser('skyshift-browser-qa');
const {page,evaluate,waitFor}=browser;
const assert=async(expression,message)=>{if(!await evaluate(expression))throw new Error(message);};
try {
    for(const width of [1440,390]) {
        await page('Emulation.setDeviceMetricsOverride',{width,height:width===1440?1000:844,deviceScaleFactor:1,mobile:width<768});
        await page('Page.navigate',{url:(process.env.SKYSHIFT_URL||'http://localhost:3001')+'/GAME/SKYSHIFT-INTERACT/index.html?qa'});
        await waitFor('!!window.__skyshift && document.getElementById("loading").hidden');
        await assert("document.documentElement.scrollWidth<=innerWidth && document.documentElement.scrollHeight<=innerHeight",'Game must fit desktop/mobile without scrolling');
        await assert("__skyshift.renderer.atlas.naturalWidth>0 && __skyshift.renderer.props.alien.naturalWidth>0 && __skyshift.renderer.props.ship.naturalWidth>0 && Object.values(__skyshift.renderer.backgrounds).every(image=>image.naturalWidth>0)",'All new art must load');
        await assert("document.querySelector('.brand').textContent.includes('TIKINTERACT') && document.getElementById('character-colors').children.length===6",'Brand and six robot skins must be present');
        await browser.screenshot(out+'/city-'+width+'.webp');
        await evaluate("__skyshift.sim.setSettings({backgroundTheme:'clouds'});__skyshift.render();__skyshift.advance(1)");
        await browser.screenshot(out+'/clouds-'+width+'.webp');
        await evaluate("__skyshift.sim.setSettings({backgroundTheme:'space'});__skyshift.render();__skyshift.advance(1)");
        await browser.screenshot(out+'/space-'+width+'.webp');
        await evaluate("__skyshift.sim.setSettings({backgroundTheme:'lava'});__skyshift.render();__skyshift.advance(1)");
        await browser.screenshot(out+'/depths-'+width+'.webp');
        await evaluate("__skyshift.sim.setSettings({backgroundTheme:'earth'});__skyshift.control({action:'session.restart'});__skyshift.render();document.getElementById('menu-toggle').click();document.getElementById('test-toggle').click()");
        await assert("!document.getElementById('game-menu').hidden && !document.getElementById('test-panel').hidden && document.getElementById('game-menu').scrollWidth<=document.getElementById('game-menu').clientWidth",'Test menu must open and fit mobile width');
        await browser.screenshot(out+'/test-menu-'+width+'.webp');
        await evaluate("document.getElementById('gift-quantity').value='2';document.querySelector('[data-action=rocket]').click()");
        await waitFor('__skyshift.sim.ledger.accepted===1');
        await evaluate("document.getElementById('menu-close').click();__skyshift.advance(.7)");
        await assert("__skyshift.sim.active?.kind==='rocket' && __skyshift.sim.distance>0 && __skyshift.sim.ledger.requestedMeters===600",'Gift menu must apply quantity and start an upward rocket effect');
        await browser.screenshot(out+'/gift-rocket-'+width+'.webp');
        await evaluate('__skyshift.advance(8)');
        await assert('__skyshift.sim.ledger.appliedMeters===600','Upward gift must apply its full distance');
        await evaluate("__skyshift.action({action:'meteor',amount:1,commandId:'meteor-qa',actor:{username:'preview'}});__skyshift.advance(1)");
        await browser.screenshot(out+'/gift-meteor-'+width+'.webp');
        await evaluate('__skyshift.advance(8)');
        await assert('__skyshift.sim.ledger.appliedMeters===300 && __skyshift.sim.ledger.completedCommands===2','Downward gift must subtract distance and complete');
        await evaluate("__skyshift.control({action:'session.restart'});__skyshift.sim.setSettings({backgroundTheme:'space'});__skyshift.action({action:'winRemove',amount:1,commandId:'alien-qa',actor:{username:'preview'}});__skyshift.render();__skyshift.advance(2.6)");
        await assert("__skyshift.renderer.scoreMoment?.kind==='theft' && __skyshift.sim.wins===-1",'Alien scene must still play for a stolen win');
        await browser.screenshot(out+'/alien-'+width+'.webp');
        await evaluate('__skyshift.advance(5)');
        await assert('__skyshift.sim.presentationErrors===0 && !__skyshift.renderer.scoreMoment','Alien scene must finish without render errors');
        await evaluate("__skyshift.control({action:'session.pause'});__skyshift.render()");
        await assert("!document.getElementById('status').hidden && __skyshift.sim.paused",'Pause overlay must remain functional');
        await browser.screenshot(out+'/pause-'+width+'.webp');
        await evaluate("__skyshift.control({action:'session.resume'});document.getElementById('menu-toggle').click();document.getElementById('setup-toggle').click()");
        for(const skin of ['Cyan','Mint','Violet','Rose','Amber','Red']) {
            await evaluate('document.querySelector(\'[data-color="'+skin+'"]\').click();__skyshift.render()');
            await assert('__skyshift.sim.settings.characterColor==='+JSON.stringify(skin),'Skin selection must update the robot');
        }
        await browser.screenshot(out+'/settings-'+width+'.webp');
        await evaluate("document.getElementById('menu-close').click();__skyshift.sim.setSettings({finishDistance:10,winCountdown:3,backgroundTheme:'clouds',characterColor:'Cyan'});__skyshift.control({action:'session.restart'});__skyshift.action({action:'rocket',amount:1,actor:{username:'preview'}});__skyshift.render();__skyshift.advance(2.2)");
        await assert("__skyshift.sim.phase==='holding' && !document.getElementById('finish-card').hidden && Number(document.getElementById('countdown').textContent)>0",'Finish must show the original countdown');
        await browser.screenshot(out+'/finish-'+width+'.webp');
        await evaluate('__skyshift.advance(5)');
        await assert('__skyshift.sim.wins===0 && __skyshift.sim.presentationErrors===0','Completing the finish must award one win after the previous alien theft');
        console.log('Verified new art, six skins, gift quantity/up/down, alien animation, pause and layout at '+width+'px.');
    }
    if(browser.errors.length)throw new Error(browser.errors.join('\n'));
    await writeFile(out+'/result.json',JSON.stringify({passed:true,widths:[1440,390],errors:browser.errors},null,2));
} finally {await browser.close();}
