import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { readFileSync } from 'node:fs';

const code = readFileSync(new URL('../assets/studio-layout.js',import.meta.url),'utf8');
const frameStub=(wrap,style=wrap.style)=>({parentElement:wrap,closest(){return wrap;},style});
for (const [width,height] of [[180,320],[260,430],[400,560],[650,720],[900,1100]]) {
    test(`game uses 80% size or fits the ${width}px available width`, () => {
        const properties = {};
        const wrap = {clientWidth:width,clientHeight:height,style:{setProperty(key,value){properties[key]=value;}}};
        const frame = frameStub(wrap,{setProperty(key,value){properties[key]=value;}});
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
    const frame = frameStub({clientWidth:0,clientHeight:0,style:{setProperty(key,value){properties[key]=value;}}});
    const context = {document:{getElementById(){return frame;},addEventListener(){}},window:{}};
    vm.createContext(context);vm.runInContext(code,context);
    context.window.TikInteractStudioLayout.fitGame();
    assert.deepEqual(properties,{});
});
test('standalone desktop Studio fits the preview to the available screen height',()=>{
    const properties={},wrap={clientWidth:650,clientHeight:768,style:{setProperty(key,value){properties[key]=value;}}};
    const context={document:{body:{classList:{contains:()=>true}},getElementById(){return frameStub(wrap);},addEventListener(){}},window:{innerWidth:1366,innerHeight:768}};
    vm.createContext(context);vm.runInContext(code,context);context.window.TikInteractStudioLayout.fitGame();
    assert.equal(Number.parseFloat(properties['--studio-preview-height']),488);
    context.window.innerHeight=1080;context.window.TikInteractStudioLayout.fitGame();
    assert(Number(properties['--game-fit-scale'])<=.8);
    assert(Number.parseFloat(properties['--studio-preview-height'])<=wrap.clientHeight);
});

for(const [width,height,windowWidth]of [[650,410,1366],[280,388,390]])test(`Studio keeps the complete game inside its ${width}x${height} panel`,()=>{
    const properties={},wrap={clientWidth:width,clientHeight:height,style:{setProperty(key,value){properties[key]=value;}}};
    const context={document:{body:{classList:{contains:()=>true}},getElementById(){return frameStub(wrap);},addEventListener(){}},window:{innerWidth:windowWidth,innerHeight:900}};
    vm.createContext(context);vm.runInContext(code,context);
    for(const [w,h]of [[540,960],[960,540]]){
        context.window.TikInteractStudioLayout.fitGame({width:w,height:h});
        const scale=Number(properties['--game-fit-scale']);
        assert(w*scale<width,'Full game width is visible');
        assert(h*scale<height,'Full game height is visible');
        assert(scale>0,'Game remains visible');
    }
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
test('OBS game capture keeps native format sizing while the original iframe is in its persistent output target',()=>{
 const props={},targetProps={},style={setProperty(k,v){props[k]=v;},getPropertyValue:k=>props[k]},target={id:'studio-game-output-target',style:{setProperty(k,v){targetProps[k]=v;}}};
 const wrap={clientWidth:650,clientHeight:410,style:{setProperty(){}}},frame={parentElement:target,closest:()=>null,style};
 const context={document:{body:{classList:{contains:()=>true}},getElementById:()=>frame,querySelector:()=>wrap,addEventListener(){}},window:{innerWidth:1366,innerHeight:900}};
 vm.createContext(context);vm.runInContext(code,context);context.window.TikInteractStudioLayout.fitGame({width:960,height:540});
 assert.equal(targetProps['--game-native-width'],'960px');assert.equal(targetProps['--game-native-height'],'540px');assert(Number(props['--game-fit-scale'])>0);
});
