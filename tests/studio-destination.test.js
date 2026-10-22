import test from 'node:test';
import assert from 'node:assert/strict';
import {initializeStudioDestination} from '../assets/studio-destination.js';

function fixture(search='?section=subscription&plan=play_pass_pro') {
    const browser=new EventTarget(),calls=[];
    browser.location={search};
    browser.document={body:{dataset:{page:'studio'}},documentElement:{dataset:{uiPending:''}}};
    browser.queueMicrotask=queueMicrotask;
    let allowed=false;
    browser.TikInteractAccount={isAllowed:()=>allowed};
    const ready=()=>{browser.tikInteractUser={id:'test'};allowed=true;browser.TikInteractStudioWindows={};delete browser.document.documentElement.dataset.uiPending;};
    initializeStudioDestination((...args)=>calls.push(args),browser);
    return {browser,calls,ready};
}
const settle=()=>new Promise(resolve=>queueMicrotask(resolve));

test('ticket deep link waits for sign-in, account permission and the final Studio shell',async()=>{
    const {browser,calls,ready}=fixture();
    await settle();assert.deepEqual(calls,[]);
    browser.tikInteractUser={id:'test'};browser.dispatchEvent(new Event('tikinteract:auth'));
    await settle();assert.deepEqual(calls,[]);
    ready();browser.document.documentElement.dataset.uiPending='';browser.dispatchEvent(new Event('tikinteract:account-status'));
    await settle();assert.deepEqual(calls,[]);
    delete browser.document.documentElement.dataset.uiPending;browser.dispatchEvent(new Event('tikinteract:ui-ready'));
    await settle();assert.deepEqual(calls,[['subscription','play_pass_pro']]);
    for(const name of ['tikinteract:auth','tikinteract:account-status','tikinteract:ui-ready'])browser.dispatchEvent(new Event(name));
    await settle();assert.equal(calls.length,1);
});

test('a late module resumes a ready session without waiting for DOMContentLoaded again',async()=>{
    const {calls,ready}=fixture('?section=subscription&plan=play_pass');ready();
    await settle();assert.deepEqual(calls,[['subscription','play_pass']]);
});

test('unknown plans cannot select a ticket and ordinary Studio entry stays closed',async()=>{
    for(const [search,expected]of [['?section=subscription&plan=invalid',[['subscription','']]],['?game=nova-vex',[]]]){
        const {calls,ready}=fixture(search);ready();await settle();assert.deepEqual(calls,expected);
    }
});
