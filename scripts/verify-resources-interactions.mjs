import assert from 'node:assert/strict';
import {openSkyShiftBrowser} from './skyshift-browser.mjs';
import {installQAAuth} from './qa-auth-fixture.mjs';

const browser = await openSkyShiftBrowser('resources-pointer-regression');
const root = process.env.MEDIA_ROOT || 'http://127.0.0.1:3004';
let touch = false;
async function press(selector) {
    const point = await browser.evaluate(`(()=>{const element=document.querySelector(${JSON.stringify(selector)});if(!element)throw Error('Missing control');element.scrollIntoView({block:'nearest'});const r=element.getBoundingClientRect();return{x:r.left+r.width/2,y:r.top+r.height/2};})()`);
    await pressAt(point);
}
async function pressAt(point) {
    if (touch) {
        await browser.page('Input.dispatchTouchEvent', {type:'touchStart',touchPoints:[point]});
        await browser.page('Input.dispatchTouchEvent', {type:'touchEnd',touchPoints:[]});
    } else {
        for (const type of ['mouseMoved','mousePressed','mouseReleased']) {
            await browser.page('Input.dispatchMouseEvent',{type,...point,...(type==='mouseMoved'?{}:{button:'left',clickCount:1})});
        }
    }
}
async function openMenu() {
    await press('.resources-trigger');
    assert.equal(await browser.evaluate('document.getElementById("resources-menu").hidden'),false);
}
async function key(key,code=key) {
    const windowsVirtualKeyCode = {Enter:13,Tab:9,Escape:27}[key];
    await browser.page('Input.dispatchKeyEvent',{type:'keyDown',key,code,windowsVirtualKeyCode,...(key==='Enter'?{text:'\r',unmodifiedText:'\r'}:{})});
    await browser.page('Input.dispatchKeyEvent',{type:'keyUp',key,code,windowsVirtualKeyCode});
}
async function centered(selector) {
    await browser.waitFor(`document.querySelector(${JSON.stringify(selector)}).getAnimations().every(animation=>animation.playState!=='running')`);
    const layout = await browser.evaluate(`(()=>{const r=document.querySelector(${JSON.stringify(selector)}).getBoundingClientRect();return{x:r.x,y:r.y,width:r.width,height:r.height,viewportWidth:innerWidth,viewportHeight:innerHeight};})()`);
    assert(Math.abs(layout.x+layout.width/2-layout.viewportWidth/2)<2,JSON.stringify(layout));
    assert(Math.abs(layout.y+layout.height/2-layout.viewportHeight/2)<2,JSON.stringify(layout));
    assert(layout.x>=0&&layout.y>=0&&layout.width<=layout.viewportWidth&&layout.height<=layout.viewportHeight);
}
try {
    await browser.page('Page.addScriptToEvaluateOnNewDocument',{source:'('+installQAAuth.toString()+')(false);window.supabase.createClient().auth.getUser=async()=>({data:{user:null},error:null});'});
    for (const width of [1440,390]) {
        touch = width < 600;
        await browser.page('Emulation.setDeviceMetricsOverride',{width,height:950,deviceScaleFactor:1,mobile:touch});
        await browser.page('Emulation.setTouchEmulationEnabled',{enabled:touch});
        await browser.page('Page.navigate',{url:root+'/'});
        await browser.waitFor('!!document.querySelector(".resources-trigger")');
        await browser.evaluate('window.scrollTo({top:180,behavior:"instant"});true');
        const locationBefore = await browser.evaluate('location.href'), scrollBefore = await browser.evaluate('window.scrollY');
        for (const destination of ['guide.html','updates.html','about.html']) {
            await openMenu();
            await press(`.resources-links a[href="${destination}"]`);
            await browser.waitFor(`document.getElementById('resource-page-dialog').dataset.state==='ready'&&document.getElementById('resource-page-dialog').dataset.page===${JSON.stringify('/'+destination)}`);
            assert.equal(await browser.evaluate('location.href'),locationBefore,'Resource content must open without navigation');
            await centered('#resource-page-dialog');
            assert.equal(await browser.evaluate('(()=>{const ids=[...document.querySelectorAll("[id]")].map(e=>e.id);return ids.length===new Set(ids).size})()'),true);
            if(destination==='guide.html') {
                await press('.resource-reader .info-jumps a[href="#resource-view-intrebari"]');
                assert.equal(await browser.evaluate('location.href'),locationBefore,'Section jumps must not alter the current route');
                await press('.resource-reader .info-faq summary');
                assert.equal(await browser.evaluate('document.querySelector(".resource-reader .info-faq details").open'),true);
            }
            await press('[data-resource-close]');
            await browser.waitFor('!document.getElementById("resource-page-dialog").open');
            assert.equal(await browser.evaluate('window.scrollY'),scrollBefore,'Closing must preserve the original page position');
        }
        await openMenu();
        await press('.resources-links [data-open-support]');
        await browser.waitFor('document.getElementById("site-support").open');
        await centered('#site-support');
        await browser.waitFor('!!document.querySelector(".support-login-notice")');
        assert.equal(await browser.evaluate('document.querySelectorAll(".si-message").length'),0);
        await press('[data-support-close]');
        await browser.waitFor('!document.getElementById("site-support").open');
        await openMenu();
        await key('Escape');
        await browser.waitFor('document.getElementById("resources-menu").hidden');
        await openMenu();
        await pressAt({x:5,y:5});
        assert.equal(await browser.evaluate('document.getElementById("resources-menu").hidden'),true,'Click outside must close the menu');
        assert.equal(await browser.evaluate('document.documentElement.scrollWidth>innerWidth'),false);
        console.log(`${width}px: real ${touch?'touch':'mouse'} opens centered resource panels and support without navigation; close, section links, FAQ, scroll preservation, Escape and outside click passed.`);
    }
    touch = false;
    await browser.page('Emulation.setTouchEmulationEnabled',{enabled:false});
    await browser.evaluate('document.querySelector(".resources-trigger").focus();true');
    await key('Enter');
    assert.equal(await browser.evaluate('document.getElementById("resources-menu").hidden'),false);
    await key('Tab');
    assert.equal(await browser.evaluate('document.activeElement.getAttribute("href")'),'guide.html');
    assert.equal(await browser.evaluate('document.getElementById("resources-menu").hidden'),false,'Tabbing into a menu must keep it open');
    await key('Escape');
    assert.equal(await browser.evaluate('document.activeElement.matches(".resources-trigger")'),true);
    await browser.page('Page.navigate',{url:root+'/guide.html'});
    await browser.waitFor('!!document.querySelector(".resources-trigger")');
    await openMenu(); await press('.resources-links a[href="guide.html"]');
    await browser.waitFor('document.getElementById("resource-page-dialog").dataset.state==="ready"');
    assert.equal(await browser.evaluate('(()=>{const ids=[...document.querySelectorAll("[id]")].map(e=>e.id);return ids.length===new Set(ids).size})()'),true,'Opening a resource from its own standalone page must not duplicate IDs');
    await key('Escape');
    await browser.waitFor('!document.getElementById("resource-page-dialog").open');
    await browser.page('Page.navigate',{url:root+'/'});
    await browser.waitFor('!!document.querySelector(".resources-trigger")');
    await browser.page('Network.enable');
    await browser.page('Network.setCacheDisabled',{cacheDisabled:true});
    await browser.page('Network.setBlockedURLs',{urls:['*about.html']});
    await openMenu(); await press('.resources-links a[href="about.html"]');
    await browser.waitFor('document.getElementById("resource-page-dialog").dataset.state==="error"');
    await browser.page('Network.setBlockedURLs',{urls:[]});
    await press('[data-resource-retry]');
    await browser.waitFor('document.getElementById("resource-page-dialog").dataset.state==="ready"');
    await browser.evaluate('document.querySelector("[data-resource-close]").click();document.querySelector(".resources-trigger").click();document.querySelector(\'.resources-links a[href="guide.html"]\').click();true');
    await browser.waitFor('document.getElementById("resource-page-dialog").dataset.state==="ready"&&document.getElementById("resource-page-dialog").dataset.page==="/guide.html"');
    assert.deepEqual(browser.errors,[]);
    console.log('Keyboard navigation, standalone-page compatibility, network-error retry, rapid reopening and browser errors passed. No support message sent.');
} finally {
    await browser.close();
}
