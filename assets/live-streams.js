import{ct,esc,ic,number,date,gameName,avatar,rpc,errorCopy,empty}from './creator-ui.js?v=1';
const KNOWN_GAMES_META = {
    'neon-race-2': {
        id: 'neon-race-2',
        name: 'NEON INTERACT',
        badge: 'Night Run',
        cover: 'assets/game-gallery/neon-interact-cover.webp?v=2',
        icon: 'fa-car-side'
    },
    'moto-interact': {
        id: 'moto-interact',
        name: 'MOTO INTERACT',
        badge: 'Day Ride',
        cover: 'assets/game-gallery/moto-interact-cover.webp?v=2',
        icon: 'fa-motorcycle'
    },
    'nova-vex': {
        id: 'nova-vex',
        name: 'NOVA & VEX',
        badge: 'Tower Ascent',
        cover: 'assets/game-gallery/nova-vex-cover.webp?v=2',
        icon: 'fa-jet-fighter-up'
    },
    'country-derby': {
        id: 'country-derby',
        name: 'COUNTRY DERBY',
        badge: '3 Echipe',
        cover: 'assets/game-gallery/neon-race-2-night.webp',
        icon: 'fa-flag-checkered'
    },
    'neon-riders': {
        id: 'neon-riders',
        name: 'NEON RIDERS',
        badge: 'Bikes',
        cover: 'assets/game-gallery/moto-interact-day.webp',
        icon: 'fa-motorcycle'
    },
    'neon-race': {
        id: 'neon-race',
        name: 'NEON RACE',
        badge: 'Classic',
        cover: 'assets/game-gallery/neon-race-2-night.webp',
        icon: 'fa-car'
    }
};


const local=(ro,en)=>window.TikInteractLanguage?.get()==='en'?en:ro;
let directory={items:[],stats:{}},filter='all',query='',request=0,loaded=false,failure='';
const $=id=>document.getElementById(id);
function game(id){return window.TikInteractPlatform?.getGame(id)||KNOWN_GAMES_META[id]||{name:gameName(id),cover:'assets/game-gallery/neon-interact-cover.webp?v=2'};}
function currentGames(){const games=window.TikInteractPlatform?.getConfig()?.games;return games?games.filter(g=>g.status==='published').map(g=>g.id):['neon-race-2','moto-interact','nova-vex'];}
function shell(){
 const root=$('view-streams');if(!root)return;root.setAttribute('data-native-i18n','');
 root.innerHTML='<div class="cp-stream-hero"><div><span class="eyebrow">'+local('COMUNITATE','COMMUNITY')+'</span><h1>'+local('Transmisiuni LIVE','Live streams')+'</h1><p>'+local('Descoperă creatorii și intră în joc alături de ei.','Discover creators and join their games.')+'</p></div><div class="cp-stream-counters" data-stream-stats></div></div><div class="cp-stream-toolbar"><label class="cp-search">'+ic('magnifying-glass')+'<input class="cp-input" id="streams-search-input" type="search" aria-label="'+ct('findStream')+'" placeholder="'+ct('findStream')+'" value="'+esc(query)+'"></label><div class="cp-stream-filters"><button type="button" data-game-filter="all">'+ct('allGames')+'</button>'+currentGames().map(id=>'<button type="button" data-game-filter="'+esc(id)+'">'+esc(game(id).name)+'</button>').join('')+'</div></div><div class="cp-stream-section-heading sr-only"><h2>'+ct('liveNow')+'</h2><span id="streams-count-label"></span></div><p id="streams-status-text" class="cp-updated" role="status"></p><div id="streams-grid" class="cp-stream-grid" aria-live="polite"></div><div id="streams-empty-state"></div><section data-stream-recent></section><div class="cp-stream-footer"><span>'+ic('arrow-up-right-from-square')+local('Urmărești transmisiunea direct pe TikTok.','Watch the stream directly on TikTok.')+'</span><button type="button" data-open-stream-studio>'+local('Vrei să apari aici? Deschide Studio','Want to join? Open Studio')+' →</button></div>';
 root.oninput=event=>{if(event.target.id==='streams-search-input')handleStreamFilterChange();};
 root.onclick=event=>{const button=event.target.closest('button');if(button?.dataset.gameFilter)setStreamsGameFilter(button.dataset.gameFilter);if(button?.hasAttribute('data-open-stream-studio'))window.checkAccessAndGo?.('live');};
}
function card(stream){
 const g=game(stream.current_game),name=stream.tiktok_display_name||stream.tiktok_username,username=stream.tiktok_username;
 const href='https://www.tiktok.com/@'+encodeURIComponent(username)+'/live';
 return '<article class="cp-stream-card"><a class="cp-stream-media" href="'+href+'" target="_blank" rel="noopener noreferrer" aria-label="'+esc(local('Vezi LIVE: ','Watch live: ')+name)+'"><img src="'+esc(g.cover)+'" alt="'+esc(g.name)+'" loading="lazy"><span class="stream-live-pill">LIVE</span><span class="cp-stream-game-overlay stream-game-tag">'+esc(g.name)+'</span></a><div class="cp-stream-card-bottom">'+avatar(name,stream.avatar_url)+'<div class="cp-stream-identity"><strong translate="no">'+esc(name)+'</strong><small translate="no">@'+esc(username)+'</small></div><a class="cp-btn" href="'+href+'" target="_blank" rel="noopener noreferrer">'+local('Vezi LIVE','Watch live')+ic('arrow-up-right-from-square')+'</a></div></article>';
}
function match(s){return(filter==='all'||s.current_game===filter)&&(!query||(s.tiktok_username+' '+(s.tiktok_display_name||'')).toLocaleLowerCase().includes(query.toLocaleLowerCase()));}
function paint(){if(!$('streams-grid'))return;const live=directory.items.filter(s=>s.is_live&&match(s)),recent=directory.items.filter(s=>!s.is_live&&match(s));
document.querySelector('[data-stream-stats]').innerHTML=failure?esc(ct('unavailable')):!loaded?esc(ct('loading')):'<i aria-hidden="true"></i><span>'+number(directory.items.filter(s=>s.is_live).length)+' '+ct('liveNow')+'</span>';
$('streams-grid').innerHTML=live.map(card).join('');$('streams-count-label').textContent=number(live.length);$('streams-status-text').textContent=failure||(loaded?ct('autoUpdate'):ct('loading'));$('streams-status-text').classList.toggle('cp-error',!!failure);
$('streams-empty-state').innerHTML=!live.length?empty(query||filter!=='all'?ct('noMatch'):ct('noStreams'),query||filter!=='all'?'':ct('noStreamsText'),'tower-broadcast'):'';
document.querySelector('[data-stream-recent]').innerHTML=recent.length?'<div class="cp-stream-section-heading"><h2>'+ct('recentlyLive')+'</h2><p class="cp-muted">'+ct('recentlyIntro')+'</p></div><div class="cp-recent-streams">'+recent.map(s=>'<a class="cp-recent-stream" target="_blank" rel="noopener noreferrer" href="https://www.tiktok.com/@'+encodeURIComponent(s.tiktok_username)+'"><img src="'+esc(game(s.current_game).cover)+'" alt="" loading="lazy"><div><strong translate="no">@'+esc(s.tiktok_username)+'</strong><small>'+esc(game(s.current_game).name)+'<br>'+ct('ended')+' · '+date(s.ended_at)+'</small></div></a>').join('')+'</div>':'';
document.querySelectorAll('[data-game-filter]').forEach(b=>{b.classList.toggle('is-active',b.dataset.gameFilter===filter);b.setAttribute('aria-pressed',String(b.dataset.gameFilter===filter));});}
async function fetchDirectory(){try{const data=await rpc('get_streams_directory');if(!Array.isArray(data?.items))throw Error();return data;}catch(e){if(!/PGRST202|does not exist|schema cache/.test((e.code||'')+' '+e.message))throw e;
// Compatibility until the new migration is installed; a saved username is never evidence of being live.
const items=await rpc('get_active_live_streams');if(!Array.isArray(items))throw e;return{items:items.map(s=>({...s,is_live:true})),stats:{live:items.length,creators:items.length}};}}
export async function loadLiveStreams(){if(!$('streams-search-input')||!document.querySelector('[data-stream-stats]'))shell();const own=++request;try{const data=await fetchDirectory();if(own!==request)return;directory=data;loaded=true;failure='';}catch(e){if(own!==request)return;failure=errorCopy(e);}paint();}
export async function loadHomeStreamsPreview(){const root=$('home-streams-list');if(!root)return;root.setAttribute('data-native-i18n','');try{const data=await fetchDirectory(),items=data.items.filter(s=>s.is_live).slice(0,3);root.innerHTML=items.length?items.map(card).join(''):empty(ct('noStreams'),ct('noStreamsText'),'tower-broadcast');}catch(e){root.innerHTML=empty(ct('unavailable'),'','tower-broadcast');}}
export function setStreamsGameFilter(value){filter=value;paint();}
export function handleStreamFilterChange(){query=$('streams-search-input')?.value||'';paint();}
export function launchGameFromStream(id){window.requestedLiveGame=id;window.checkAccessAndGo?.('live');}
Object.assign(window,{loadLiveStreams,loadHomeStreamsPreview,setStreamsGameFilter,handleStreamFilterChange,launchGameFromStream});
window.addEventListener('tikinteract:language',()=>{if(document.querySelector('[data-stream-stats]')){shell();paint();}if($('home-streams-list'))loadHomeStreamsPreview();});
setInterval(()=>{if(!document.hidden&&$('view-streams')&&!$('view-streams').classList.contains('hidden'))loadLiveStreams();},30000);

window.addEventListener('tikinteract:config',()=>{if(document.querySelector('[data-stream-stats]')){shell();paint();}});
