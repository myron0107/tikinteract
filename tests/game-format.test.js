import test from'node:test';import assert from'node:assert/strict';import vm from'node:vm';import{readFileSync}from'node:fs';
test('game orientation accepts only its same-origin parent, preserving the running document',()=>{
 const listeners={},events=[],parent={},window={addEventListener(type,fn){listeners[type]=fn;},dispatchEvent(e){events.push(e.type);}},html={dataset:{}};
 const code=readFileSync(new URL('../assets/game-format.js',import.meta.url),'utf8').replaceAll('export const','const').replaceAll('import.meta.url',"'http://localhost/assets/game-format.js'");
 const context={URL,URLSearchParams,location:{search:'?format=portrait',origin:'http://localhost'},parent,window,document:{documentElement:html,createElement:()=>({}),head:{append(){}}},Event:class{constructor(type){this.type=type;}},CustomEvent:class{constructor(type,options){this.type=type;this.detail=options.detail;}}};
 vm.createContext(context);vm.runInContext(code,context);
 for(const [source,origin,format]of[[{},'http://localhost','landscape'],[parent,'https://other.invalid','landscape'],[parent,'http://localhost','invalid']])listeners.message({source,origin,data:{type:'tikinteract:format',format}});
 assert.equal(window.TikInteractGameFormat.get(),'portrait');assert.equal(events.length,0);
 listeners.message({source:parent,origin:'http://localhost',data:{type:'tikinteract:format',format:'landscape'}});
 assert.equal(window.TikInteractGameFormat.get(),'landscape');assert.equal(html.dataset.gameFormat,'landscape');assert.equal(window.TikInteractGameFormat.size().width,960);assert.equal(window.TikInteractGameFormat.size().height,540);assert.deepEqual(events,['tikinteract:game-format','resize']);
 window.TikInteractGameFormat.set('portrait');assert.equal(window.TikInteractGameFormat.get(),'landscape','An embedded game cannot override the Studio viewport');
});
