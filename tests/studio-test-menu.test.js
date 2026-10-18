import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

class Element {
    constructor(tag = 'div', attributes = {}) {
        this.tagName = tag.toUpperCase(); this.attributes = {...attributes};
        this.id = attributes.id; this.type = attributes.type || ''; this.value = attributes.value || '';
        this.children = []; this.events = {}; this.dataset = {};
        for (const [key,value] of Object.entries(attributes)) if (key.startsWith('data-')) this.dataset[key.slice(5)] = value;
        this.style = {setProperty:(key,value) => {this.style[key] = value;}};
        this.hidden = false; this.isConnected = true; this.textContent = this.id || '';
        this.options = []; this.calls = []; this.validity = {customError:false};
    }
    hasAttribute(key) { return key in this.attributes; }
    getAttribute(key) { return this.attributes[key]; }
    setAttribute(key,value) { this.attributes[key] = String(value); }
    addEventListener(type,handler) { (this.events[type] ||= []).push(handler); }
    append(...items) { this.children.push(...items); }
    replaceChildren() { this.children = []; }
    dispatchEvent(event) { this.calls.push(event.type); for (const handler of this.events[event.type] || []) handler(event); }
    click() { this.dispatchEvent({type:'click'}); }
    closest() { return new Element(); }
    setCustomValidity() {}
    getClientRects() { return [{}]; }
}

function setup(gameId, path) {
    const html = fs.readFileSync(new URL(`../${path}`, import.meta.url),'utf8');
    const source = {}, teams = [];
    for (const match of html.matchAll(/<(button|input|select|p|span|div|section)\b([^>]*)>/g)) {
        const attrs = Object.fromEntries([...match[2].matchAll(/([\w-]+)\s*=\s*"([^"]*)"/g)].map(item => [item[1],item[2]]));
        if (!attrs.id && attrs['data-team'] === undefined) continue;
        const element = new Element(match[1],attrs);
        if (attrs.id) source[attrs.id] = element;
        if (/^[0-2]$/.test(attrs['data-team'])) teams.push(element);
    }
    if (gameId === 'country-derby') for (let team=0;team<3;team++) for (const action of ['likes','gift']) teams.push(new Element('button',{'data-team':String(team),'data-action':action}));
    for (const element of Object.values(source)) if (element.tagName === 'SELECT') element.options = [{value:'day',textContent:'Day'},{value:'night',textContent:'Night'}];
    const original = source[gameId === 'country-derby' ? 'settings' : 'testPanel'];
    original.querySelectorAll = () => teams;
    const gameDocument = {getElementById:id => source[id],createElement:tag => new Element(tag),head:new Element()};
    const elements = Object.fromEntries(['studio-test-panel','studio-test-controls','studio-test-game-name','studio-test-feedback','studio-test-tabs'].map(id => [id,new Element()]));
    elements['live-game-select'] = {selectedOptions:[{textContent:gameId}]};
    elements['live-game-frame'] = {dataset:{gameId}, contentDocument:gameDocument, contentWindow:{Event:class {constructor(type){this.type=type;}}, KeyboardEvent:class {constructor(type,options){this.type=type;Object.assign(this,options);}}}};
    const timers = new Set(); let nextTimer=0;
    const context = {document:{getElementById:id => elements[id],createElement:tag => new Element(tag)},setInterval(){timers.add(++nextTimer);return nextTimer;},clearInterval(timer){timers.delete(timer);}};
    vm.createContext(context);
    vm.runInContext(fs.readFileSync(new URL('../assets/studio-test-menu.js',import.meta.url),'utf8'),context);
    return {context,elements,source,original,timers,pairs:() => vm.runInContext('studioTestBridge.pairs',context)};
}

for (const [gameId,path] of [['neon-race','GAME/NEON-RACE/Neon-Race.html'],['neon-riders','GAME/NEON-RIDERS/NEON-RIDERS.html'],['country-derby','GAME/COUNTRY-DERBY/COUNTRY-DERBY.html']]) {
    test(`${gameId}: test controls are always open and remain connected to game actions`, () => {
        const {context,elements,source,original,timers,pairs} = setup(gameId,path);
        context.initializeStudioTestMenu();
        assert.equal(elements['studio-test-panel'].hidden,false);
        assert.equal(elements['studio-test-panel'].getAttribute('aria-busy'),'false');
        assert.equal(original.hidden,true);
        assert.equal(original.style.display,'none');
        assert(elements['studio-test-controls'].children.every(section => section.tagName === 'SECTION'));
        const sections = elements['studio-test-controls'].children;
        assert.equal(sections.filter(section => !section.hidden).length,2);
        assert.equal(elements['studio-test-tabs'].children.length,4);
        assert(!elements['studio-test-tabs'].children.some(tab => tab.id === 'studio-test-tab-extra'));
        assert(!sections.some(section => section.dataset.studioTestCategory === 'extra'));
        context.selectStudioTestTab('audio');
        assert(sections.filter(section => !section.hidden).every(section => ['audio','common'].includes(section.dataset.studioTestCategory)));
        context.selectStudioTestTab('teams');
        assert.equal(timers.size,1);
        const pause = pairs().find(pair => pair.source === source.pause);
        pause.proxy.click(); assert(source.pause.calls.includes('click'));
        source.pause.textContent = 'RESUME'; context.syncStudioTestMenu();
        assert.equal(pause.proxy.textContent,'Reia cursa');
        const team = pairs().find(pair => pair.source.dataset.team !== undefined);
        team.proxy.click(); assert(team.source.calls.includes('click'));
        assert(team.proxy.getAttribute('aria-label').includes('RED'));
        const volume = pairs().find(pair => pair.source === (source.volumeMaster || source.volume));
        volume.proxy.value = '21'; volume.proxy.dispatchEvent({type:'input'});
        assert.equal(volume.source.value,'21'); assert.equal(volume.value.textContent,'21%');
        const file = pairs().find(pair => pair.source.type === 'file');
        file.proxy.files = {name:'music.mp3'}; file.proxy.dispatchEvent({type:'change'});
        assert.equal(file.source.files,file.proxy.files);
        context.initializeStudioTestMenu(); assert.equal(timers.size,1);
        context.resetStudioTestMenu(); assert.equal(timers.size,0);
        assert.equal(elements['studio-test-controls'].children.length,0);
        assert.equal(elements['studio-test-panel'].hidden,false);
    });
}
