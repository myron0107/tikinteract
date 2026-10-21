import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';
const source=readFileSync(new URL('../assets/site-app.js',import.meta.url),'utf8');
const routing=source.slice(source.indexOf('function switchView(view)'),source.indexOf('function openCookiePreferences()'));
const urlHelper=source.slice(source.indexOf('function studioUrl('),source.indexOf('let shouldOpenLiveFromUrl'));
function setup(studio=false){
    const navigations=[],loaded=[],views=new Map(['home','catalog','streams','leaderboard','play-pass','account'].map(name=>[name,{hidden:name!=='home'}]));
    const context={isStudioPage:studio,currentUser:null,shouldOpenLiveFromUrl:false,pendingAccountRoute:false,requestedStudioSection:'',requestedStudioPlan:'',requestedLiveGame:'moto-interact',LIVE_GAME_PATHS:{'moto-interact':'game','neon-race-2':'game'},
        document:{body:{classList:{toggle(){}}},querySelectorAll(){return[];},getElementById(id){if(id==='live-game-select')return studio?{value:'moto-interact'}:null;const view=views.get(id.replace('view-',''));return view?{classList:{toggle(name,value){view.hidden=value;}}}:null;}},
        window:{location:{assign(url){navigations.push(url);}},scrollTo(){}},history:{replaceState(){}},
        setActiveNavigation(){},loadLeaderboard(){loaded.push('leaderboard');},loadHomeLeaderboard(){loaded.push('home');},loadLiveGame(id){loaded.push(id);},openAuthModal(){loaded.push('auth');}};
    const access=source.slice(source.indexOf('function checkAccessAndGo(view)'),source.indexOf('function goToPlayPass()'));
    const subscription=source.slice(source.indexOf("function openStudioSubscription("),source.indexOf('function syncTikTokAccount()'));
    vm.createContext(context);vm.runInContext(urlHelper+routing+access+subscription,context);return{context,navigations,loaded,views};
}
test('public Studio navigation opens its own page and preserves the requested game',()=>{
    const {context,navigations}=setup();context.currentUser={id:'test'};context.switchView('live');
    assert.deepEqual(navigations,['live-studio.html?game=moto-interact']);
    assert.equal(context.studioUrl('invalid'),'live-studio.html');
});

test('visitors must authenticate before opening Studio through any public route',()=>{
    const {context,navigations,loaded}=setup();context.switchView('live');context.checkAccessAndGo('live');
    assert.deepEqual(navigations,[]);assert.deepEqual(loaded,['auth','auth']);
    assert.equal(context.shouldOpenLiveFromUrl,true);
});
test('Studio entry points remain visible in the homepage markup for visitors',()=>{
    const home=readFileSync(new URL('../index.html',import.meta.url),'utf8');
    assert.match(home,/<button\b[^>]*data-nav-item="live"[^>]*onclick="checkAccessAndGo\('live'\)"[^>]*>/);
    assert.match(home,/<button[^>]*class="public-button public-primary"[^>]*onclick="checkAccessAndGo\('live'\)"[^>]*>/);
    assert.doesNotMatch(home,/<button[^>]*data-nav-item="live"[^>]*\bhidden\b/);
    assert.doesNotMatch(home,/<button[^>]*class="home-primary-button"[^>]*\bhidden\b/);
});
test('public views work without Studio DOM and account still requires authentication',()=>{
    const {context,views,loaded}=setup();context.switchView('catalog');
    assert.equal(views.get('catalog').hidden,false);assert.equal(views.get('home').hidden,true);
    context.switchView('streams');
    assert.equal(views.get('streams').hidden,false);assert.equal(views.get('catalog').hidden,true);
    context.switchView('account');assert.deepEqual(loaded,['auth']);assert.equal(context.pendingAccountRoute,true);
    context.currentUser={id:'test'};context.switchView('account');assert.equal(views.get('account').hidden,false);
});
test('Studio keeps its game when returning to the workspace and links back to public pages',()=>{
    const {context,navigations,loaded}=setup(true);context.currentUser={id:'test'};context.switchView('live');context.switchView('catalog');
    assert.deepEqual(loaded,[]);assert.deepEqual(navigations,['index.html?view=catalog']);
});
test('Studio startup ignores cached and URL games until the user chooses one',async()=>{
    const startup=source.slice(source.indexOf("window.addEventListener('DOMContentLoaded'"),source.indexOf('function restorePendingLiveRoute()'));
    for(const query of ['', '?game=moto-interact']){
        const {context,loaded}=setup(true);let ready;
        context.initialRoute=new URLSearchParams(query);
        context.window.addEventListener=(type,callback)=>{if(type==='DOMContentLoaded')ready=callback;};
        context.restorePendingLiveRoute=()=>{};
        context.localStorage={getItem:()=> 'moto-interact'};
        context.console=console;
        context.updateUI=()=>{};
        vm.runInContext(startup,context);await ready();
        assert(!loaded.includes('moto-interact'));assert(!loaded.includes('neon-race-2'));
    }
});
test('auth callbacks do not start a requested game on the Studio page',()=>{
    const update=source.slice(source.indexOf('function updateUI(session)'),source.indexOf('function openAuthModal()'));
    const {context,loaded}=setup(true);
    context.document.getElementById=()=>null;
    context.shouldOpenLiveFromUrl=true;context.hasPendingLiveReturn=false;
    context.isPasswordRecovery=false;context.closeAuthModal=()=>{};
    vm.runInContext(update,context);
    context.updateUI({user:{id:'test-user',email:'test@example.invalid'}});
    assert.deepEqual(loaded,[]);
});
test('approved homepage and Studio stay separate, with real games unloaded until selected',()=>{
    const home=readFileSync(new URL('../index.html',import.meta.url),'utf8'),studio=readFileSync(new URL('../live-studio.html',import.meta.url),'utf8');
    assert(!home.includes('id="live-game-frame"'));assert(!studio.includes('id="view-home"'));
    assert(home.includes('data-home-reel'));assert(home.includes('id="approved-home-games"'));
    assert(home.includes('id="approved-home-plans"'));assert(home.includes('id="how-it-works"'));
    assert(!home.slice(home.indexOf('<main id="view-home"'),home.indexOf('<!-- GAME CATALOG -->')).includes('data-home-nova'));
    assert(home.includes('data-catalog-featured'));assert(!home.includes('id="download-app"'));assert(!home.includes('id="view-play-pass"'));
    assert(home.includes('data-nav-item="live"'));
    assert(studio.includes('id="live-game-frame"'));assert(studio.includes('id="studio-test-panel"'));
    assert.match(studio,/<iframe id="live-game-frame"[^>]*\bhidden\b[^>]*>/);
    assert.match(studio,/<option value="" selected disabled>/);
    assert(studio.includes('studio-app studio-locked'));assert(studio.includes('id="studio-access-gate"'));
});

test('ticket selection requires sign-in and preserves the selected plan in the Studio URL',()=>{
    const {context,navigations,loaded}=setup();
    context.openStudioSubscription('play_pass_pro');
    assert.deepEqual(loaded,['auth']);assert.deepEqual(navigations,[]);
    assert.equal(context.studioUrl(null),'live-studio.html?section=subscription&plan=play_pass_pro');
    context.currentUser={id:'test'};context.switchView('live');
    assert.deepEqual(navigations,['live-studio.html?section=subscription&plan=play_pass_pro']);
});

test('generic Studio entry clears a previously cancelled subscription choice',()=>{
    const {context,navigations}=setup();context.openStudioSubscription('play_pass');
    context.currentUser={id:'test'};context.checkAccessAndGo('live');
    assert.deepEqual(navigations,['live-studio.html']);
});

test('a subscription return from OAuth consumes only a validated, single-use destination',()=>{
    const fragment=source.slice(source.indexOf('function restorePendingLiveRoute()'),source.indexOf('function updateUI(session)'));
    for(const [plan,expected]of[['play_pass_pro','play_pass_pro'],['invalid','']]){
        const {context}=setup();const stored=new Map([['tikinteract-studio-return',JSON.stringify({section:'subscription',plan})]]);
        context.sessionStorage={getItem:key=>stored.get(key)||null,removeItem:key=>stored.delete(key)};
        context.hasPendingLiveReturn=false;vm.runInContext(fragment,context);context.restorePendingLiveRoute();
        assert.equal(context.requestedStudioSection,'subscription');assert.equal(context.requestedStudioPlan,expected);
        assert.equal(context.hasPendingLiveReturn,true);assert.equal(stored.has('tikinteract-studio-return'),false);
    }
});
