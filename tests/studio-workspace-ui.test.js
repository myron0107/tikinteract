import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
globalThis.window={TikInteractLanguage:{get:()=> 'ro'},TikInteractPass:{getAccess:()=>({plan:'free'})}};
const {renderAnimationWorkspace}=await import('../assets/animations-workspace-views.js');
test('Studio serves separate AI navigation and common topbar credits while LIVE animations stays a saved-media library',()=>{
 const html=readFileSync(new URL('../live-studio.html',import.meta.url),'utf8'),top=html.slice(html.indexOf('<header class="template-header app-topbar"'),html.indexOf('</header>',html.indexOf('<header class="template-header app-topbar"')));
 assert(top.includes('data-workspace="ai"'));assert(top.includes('data-credit-balance'));assert(top.includes('data-credit-topup'));assert(top.includes('data-mode-toggle'));assert(top.includes('data-studio-theme'));
 const nav=html.slice(html.indexOf('<nav id="studio-ai-nav"'),html.indexOf('</nav>',html.indexOf('<nav id="studio-ai-nav"')));for(const tab of ['generator','universes','library','credits','guide'])assert(nav.includes(`data-ai-tab="${tab}"`));
 const state={workspace:'live',tab:'library',ready:true,config:{enabled:false,testMode:true},library:[],worlds:[],filter:'all',query:''};const live=renderAnimationWorkspace(state);assert(!live.includes('data-an-action="open-ai"'));assert(!live.includes('id="an-prompt"'));assert(live.includes('data-an-tab="library"'));assert(live.includes('data-an-tab="events"'));
});
test('AI backend failure retains the workspace heading and local guide without inventing wallet data',()=>{
 const state={workspace:'ai',tab:'generator',ready:false,loading:false,error:'ANIM_SETUP_REQUIRED'};
 const error=renderAnimationWorkspace(state);assert(error.includes('Generator AI'));assert(error.includes('data-an-action="refresh"'));assert(!error.includes('id="an-prompt"'));assert(!error.includes('0 credite'));assert.match(error,/data-an-action="topup" disabled/);
 const guide=renderAnimationWorkspace({...state,tab:'guide'});assert(guide.includes('ai-guide-grid'));assert(guide.includes('data-an-open-tab="generator"'));assert(!guide.includes('role="tablist"'));
});
