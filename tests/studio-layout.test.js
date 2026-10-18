import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { readFileSync } from 'node:fs';

const code = readFileSync(new URL('../assets/studio-layout.js',import.meta.url),'utf8');
for (const [width,height] of [[180,320],[260,430],[400,560],[650,720],[900,1100]]) {
    test(`game uses 80% size or fits the ${width}px available width`, () => {
        const properties = {};
        const wrap = {clientWidth:width,clientHeight:height,style:{setProperty(key,value){properties[key]=value;}}};
        const frame = {parentElement:wrap,style:{setProperty(key,value){properties[key]=value;}}};
        const context = {document:{getElementById(){return frame;},addEventListener(){}},window:{}};
        vm.createContext(context); vm.runInContext(code,context);
        context.window.TikInteractStudioLayout.fitGame();
        const scale = Number(properties['--game-fit-scale']);
        assert(540*scale <= width+.001);
        assert.equal(scale, Math.min(width/540,.8));
        assert.equal(Number.parseFloat(properties['--studio-preview-height']), 960*scale);
        assert.equal(properties['--game-native-width'],'540px');
        assert.equal(properties['--game-native-height'],'960px');
        context.window.TikInteractStudioLayout.fitGame({width:1280,height:720});
        const landscape = Number(properties['--game-fit-scale']);
        assert(1280*landscape <= width+.001);
        assert.equal(landscape,Math.min(width/1280,.8));
        context.window.TikInteractStudioLayout.fitGame({width:Infinity,height:0});
        assert.equal(properties['--game-native-width'],'1280px');
    });
}
test('hidden preview waits for a real size instead of setting invalid scaling', () => {
    const properties = {};
    const frame = {parentElement:{clientWidth:0,clientHeight:0,style:{setProperty(key,value){properties[key]=value;}}},style:{setProperty(key,value){properties[key]=value;}}};
    const context = {document:{getElementById(){return frame;},addEventListener(){}},window:{}};
    vm.createContext(context);vm.runInContext(code,context);
    context.window.TikInteractStudioLayout.fitGame();
    assert.deepEqual(properties,{});
});
test('standalone desktop Studio fits the preview to the available screen height',()=>{
    const properties={},wrap={clientWidth:650,clientHeight:768,style:{setProperty(key,value){properties[key]=value;}}};
    const context={document:{body:{classList:{contains:()=>true}},getElementById(){return{parentElement:wrap,style:wrap.style};},addEventListener(){}},window:{innerWidth:1366,innerHeight:768}};
    vm.createContext(context);vm.runInContext(code,context);context.window.TikInteractStudioLayout.fitGame();
    assert.equal(Number.parseFloat(properties['--studio-preview-height']),488);
    context.window.innerHeight=1080;context.window.TikInteractStudioLayout.fitGame();
    assert.equal(Number(properties['--game-fit-scale']),.8);
});
test('game viewport normalization applies only inside Studio', () => {
    const source = readFileSync(new URL('../assets/game-viewport.js',import.meta.url),'utf8');
    for (const embedded of [true,false]) {
        const styles = [];
        const window = {dispatchEvent(){}};window.parent = embedded ? {} : window;
        const context = {window,document:{createElement(){return {};},head:{append(style){styles.push(style);}}},requestAnimationFrame(){},Event:class{}};
        vm.createContext(context);vm.runInContext(source,context);
        assert.equal(styles.length,embedded?1:0);
        if(embedded)assert(styles[0].textContent.includes('height:100vh!important'));
    }
});
