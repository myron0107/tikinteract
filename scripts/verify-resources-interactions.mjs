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
try {
    await browser.page('Page.addScriptToEvaluateOnNewDocument',{source:'('+installQAAuth.toString()+')(false)'});
    for (const width of [1440,390]) {
        touch = width < 600;
        await browser.page('Emulation.setDeviceMetricsOverride',{width,height:950,deviceScaleFactor:1,mobile:touch});
        await browser.page('Emulation.setTouchEmulationEnabled',{enabled:touch});
        await browser.page('Page.navigate',{url:root+'/'});
        await browser.waitFor('!!document.querySelector(".resources-trigger")');
        for (const destination of ['guide.html','updates.html','about.html']) {
            await openMenu();
            await press(`.resources-links a[href="${destination}"]`);
            await browser.waitFor(`location.pathname.endsWith(${JSON.stringify('/'+destination)})&&!!document.querySelector('.resources-trigger')`);
        }
        await openMenu();
        await press('.resources-links [data-open-support]');
        await browser.waitFor('document.getElementById("site-support").open');
        for (const topic of ['game','bug','idea','question']) {
            await press(`[data-support-topic="${topic}"]`);
            assert.equal(await browser.evaluate('document.querySelector("[data-support-write]").hidden'),false);
            await press('[data-support-back]');
        }
        await press('[data-support-close]');
        await browser.waitFor('!document.getElementById("site-support").open');
        await openMenu();
        await key('Escape');
        await browser.waitFor('document.getElementById("resources-menu").hidden');
        await openMenu();
        await pressAt({x:5,y:5});
        assert.equal(await browser.evaluate('document.getElementById("resources-menu").hidden'),true,'Click outside must close the menu');
        assert.equal(await browser.evaluate('document.documentElement.scrollWidth>innerWidth'),false);
        console.log(`${width}px: real ${touch?'touch':'mouse'} opens every resource link and all four support topics; close, Escape and outside click passed.`);
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
    assert.deepEqual(browser.errors,[]);
    console.log('Keyboard navigation and browser errors passed. No support message sent.');
} finally {
    await browser.close();
}
