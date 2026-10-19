export const DEFAULT_CONFIG = {
    schemaVersion:1,
    plans:[
        {id:'free',name:'FREE',priceCents:0,currency:'RON',enabled:true,features:['Acces la funcțiile de bază','Conectare TikTok LIVE','Profil și clasament public']},
        {id:'play_pass',name:'Play Pass',priceCents:2900,currency:'RON',enabled:true,features:['Jocurile marcate Play Pass','Conectare TikTok LIVE','Acces prin cheie, în cont']},
        {id:'play_pass_pro',name:'Play Pass PRO',priceCents:7900,currency:'RON',enabled:true,features:['Jocurile Play Pass și PRO','Conectare TikTok LIVE','Timpul Play Pass rămas se păstrează']}
    ],
    games:[
        {id:'neon-race-2',name:'NEON INTERACT',cover:'assets/game-gallery/neon-interact-cover.webp?v=2',entryPath:'GAME/NEON-INTERACT/Neon-Interact.html',presentationPath:'GAME/NEON-INTERACT/index.html',status:'published',plan:'free',description:'Alege RED sau BLUE și intră în cursa de noapte.'},
        {id:'moto-interact',name:'MOTO INTERACT',cover:'assets/game-gallery/moto-interact-cover.webp?v=2',entryPath:'GAME/MOTO-INTERACT/Moto-Interact.html',presentationPath:'GAME/MOTO-INTERACT/index.html',status:'published',plan:'free',description:'Două echipe, motoare și o cursă decisă de public.'},
        {id:'nova-vex',name:'NOVA & VEX',cover:'assets/game-gallery/nova-vex-cover.webp?v=2',entryPath:'GAME/NOVA-VEX/Neon-Ascent.html',presentationPath:'GAME/NOVA-VEX/index.html',status:'published',plan:'free',description:'Ajut-o pe Nova să urce și ai grijă la Vex.'},
        {id:'neon-race',name:'NEON RACE',cover:'assets/game-gallery/neon-race-2-night.webp',entryPath:'GAME/NEON-RACE/Neon-Race.html',presentationPath:'GAME/NEON-RACE/index.html',status:'disabled',plan:'free',description:'Joc păstrat în arhivă.'},
        {id:'neon-riders',name:'NEON RIDERS',cover:'assets/game-gallery/moto-interact-day.webp',entryPath:'GAME/NEON-RIDERS/NEON-RIDERS.html',presentationPath:'GAME/NEON-RIDERS/index.html',status:'disabled',plan:'free',description:'Joc păstrat în arhivă.'},
        {id:'country-derby',name:'COUNTRY DERBY',cover:'assets/game-gallery/neon-race-2-night.webp',entryPath:'GAME/COUNTRY-DERBY/COUNTRY-DERBY.html',presentationPath:'GAME/COUNTRY-DERBY/index.html',status:'disabled',plan:'free',description:'Joc păstrat în arhivă.'}
    ],
    home:{heading:'Fă din LIVE-ul tău',accent:'un joc de echipă.',intro:'Alege jocul, conectează LIVE-ul și lasă chatul să intre în acțiune.'},
    studio:{left:['games','controls'],right:['streamer','audio','stats','feed'],density:'normal',side:'standard'}
};

export const PANEL_NAMES={games:'Favorite jocuri',controls:'CONTROL JOC',streamer:'Setări Streamer',audio:'Favorite audio',stats:'Statistici',feed:'Activitate LIVE'};
export const cloneConfig=value=>JSON.parse(JSON.stringify(value));
const text=(value,max)=>typeof value==='string'&&value.trim().length>0&&value.length<=max;
export function safeCover(value){return typeof value==='string'&&value.length<=2048&&(/^(?:assets\/)[A-Za-z0-9_./-]+\.(?:webp|png|jpe?g)(?:\?v=\d+)?$/.test(value)||/^https:\/\/[^\s<>"']+$/.test(value))&&!value.includes('..');}
export function safeGamePath(value){return typeof value==='string'&&/^GAME\/[A-Za-z0-9_-]+\/[A-Za-z0-9_.-]+\.html$/.test(value)&&!value.includes('..');}
export function validateConfig(input){
    const fail=message=>{throw Error(message);};
    if(!input||input.schemaVersion!==1)fail('Configurație incompatibilă.');
    if(!Array.isArray(input.plans)||input.plans.length!==3)fail('Sunt necesare cele trei planuri.');
    const plans=new Set();
    for(const p of input.plans){if(!['free','play_pass','play_pass_pro'].includes(p.id)||plans.has(p.id)||!text(p.name,60)||!Number.isSafeInteger(p.priceCents)||p.priceCents<0||p.priceCents>10000000||(p.id==='free'&&p.priceCents!==0)||!['RON','EUR','USD'].includes(p.currency)||typeof p.enabled!=='boolean'||!Array.isArray(p.features)||p.features.length>12||p.features.some(x=>!text(x,160)))fail('Verifică numele, prețul și beneficiile abonamentelor.');plans.add(p.id);}
    if(!Array.isArray(input.games)||input.games.length>200)fail('Catalogul poate conține cel mult 200 de jocuri.');
    const games=new Set();
    for(const g of input.games){if(!/^[a-z0-9][a-z0-9-]{1,59}$/.test(g.id)||games.has(g.id)||!text(g.name,80)||!safeCover(g.cover)||!safeGamePath(g.entryPath)||(g.presentationPath&&!safeGamePath(g.presentationPath))||!['published','draft','disabled'].includes(g.status)||!plans.has(g.plan)||!text(g.description,500))fail('Verifică datele jocurilor: ID unic, copertă, fișier HTML și descriere.');games.add(g.id);}
    if(!input.home||!text(input.home.heading,100)||!text(input.home.accent,100)||!text(input.home.intro,300))fail('Completează textele pentru ACASĂ.');
    const s=input.studio,all=s&&Array.isArray(s.left)&&Array.isArray(s.right)?[...s.left,...s.right]:[];
    if(all.length!==6||new Set(all).size!==6||all.some(x=>!Object.hasOwn(PANEL_NAMES,x))||!['normal','compact'].includes(s.density)||!['standard','reversed'].includes(s.side))fail('Fiecare panou Studio trebuie să apară exact o dată.');
    return cloneConfig(input);
}
