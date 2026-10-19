// Site-owned controls, connected to the same-origin game's existing handlers.
let studioTestBridge = null;
let studioTestSyncTimer = null;

function resetStudioTestMenu() {
    clearInterval(studioTestSyncTimer);
    studioTestSyncTimer = null;
    studioTestBridge = null;
    const panel = document.getElementById('studio-test-panel');
    if (panel) panel.setAttribute('aria-busy', 'true');
    const gameName = document.getElementById('studio-test-game-name');
    if (gameName) gameName.textContent = 'Se încarcă comenzile…';
    document.getElementById('studio-test-controls')?.replaceChildren();
    document.getElementById('studio-test-tabs')?.replaceChildren();
    const feedback = document.getElementById('studio-test-feedback');
    if (feedback) feedback.textContent = '';
}

function initializeStudioTestMenu() {
    resetStudioTestMenu();
    const frame = document.getElementById('live-game-frame');
    if (!frame?.dataset.gameId) { showStudioTestUnavailable('Alege un joc pentru a vedea comenzile.'); return; }
    try {
        const gameDocument = frame.contentDocument;
        if(frame.contentWindow.TikInteractStudioControls){initializeActionGameTestMenu(frame,gameDocument);return;}
        const isDerby = frame.dataset.gameId === 'country-derby';
        const original = gameDocument?.getElementById(isDerby ? 'settings' : 'testPanel');
        if (!original) { showStudioTestUnavailable('Acest joc nu oferă încă un panou de test.'); return; }
        studioTestBridge = {frame, gameDocument, pairs: [], groups: [], tabs: []};
        original.hidden = true;
        original.style.setProperty('display', 'none', 'important');
        const launcher = gameDocument.getElementById(isDerby ? 'menu' : 'testToggle');
        if (launcher) { launcher.hidden = true; launcher.style.setProperty('display', 'none', 'important'); }
        const dock = isDerby ? gameDocument.getElementById('controls') : launcher?.closest('.controls');
        if (dock) dock.style.setProperty('display', 'none', 'important');
        if (!isDerby && !gameDocument.getElementById('studio-external-controls-style')) {
            const style = gameDocument.createElement('style');
            style.id = 'studio-external-controls-style';
            style.textContent = 'body{padding-top:0!important}';
            gameDocument.head.append(style);
        }
        const name = document.getElementById('live-game-select')?.selectedOptions[0]?.textContent || 'Joc';
        document.getElementById('studio-test-game-name').textContent = name;
        buildStudioTestControls(original);
        document.getElementById('studio-test-panel').setAttribute('aria-busy', 'false');
        syncStudioTestMenu();
        studioTestSyncTimer = setInterval(() => {
            if (!document.hidden && document.getElementById('studio-test-panel')?.getClientRects().length) syncStudioTestMenu();
        }, 300);
    } catch {
        resetStudioTestMenu();
        showStudioTestUnavailable('Comenzile nu sunt disponibile momentan. Reîncarcă jocul.');
    }
}

function showStudioTestUnavailable(message) {
    document.getElementById('studio-test-panel')?.setAttribute('aria-busy', 'false');
    const label = document.getElementById('studio-test-game-name');
    if (label) label.textContent = message;
}

function createStudioTestGroup(title, kind, category = kind) {
    const section = document.createElement('section');
    section.className = `studio-test-group${kind ? ` studio-test-group--${kind}` : ''}`;
    section.dataset.studioTestCategory = category;
    const heading = document.createElement('h6');
    heading.textContent = title;
    const body = document.createElement('div');
    body.className = 'studio-test-group-body';
    section.append(heading, body);
    document.getElementById('studio-test-controls').append(section);
    studioTestBridge.groups.push({section, category});
    return body;
}

function initializeStudioTestTabs() {
    const nav = document.getElementById('studio-test-tabs');
    if (!nav || !studioTestBridge) return;
    const categories = [['teams','Test'],['gifts','Cadouri LIVE'],['appearance','Aspect'],['weather','Decor'],['audio','Audio'],['music','Muzică']];
    for (const [key, label] of categories) {
        if (!studioTestBridge.groups.some(group => group.category === key)) continue;
        const button = document.createElement('button');
        button.type = 'button'; button.textContent = label;
        button.id = `studio-test-tab-${key}`;
        button.setAttribute('role','tab');
        button.setAttribute('aria-controls', `studio-test-controls`);
        button.addEventListener('click', () => selectStudioTestTab(key));
        button.addEventListener('keydown', event => {
            if (!['ArrowLeft','ArrowRight','Home','End'].includes(event.key)) return;
            event.preventDefault();
            const tabs = studioTestBridge.tabs;
            const index = tabs.findIndex(tab => tab.key === key);
            const next = event.key === 'Home' ? 0 : event.key === 'End' ? tabs.length-1 : (index + (event.key === 'ArrowRight' ? 1 : -1) + tabs.length) % tabs.length;
            selectStudioTestTab(tabs[next].key);
            tabs[next].button.focus();
        });
        nav.append(button);
        studioTestBridge.tabs.push({key,button});
    }
    selectStudioTestTab('teams');
}

function selectStudioTestTab(key) {
    if (!studioTestBridge || !studioTestBridge.tabs.some(tab => tab.key === key)) return;
    for (const group of studioTestBridge.groups) group.section.hidden = group.category !== key && group.category !== 'common';
    for (const tab of studioTestBridge.tabs) {
        tab.button.setAttribute('aria-selected', String(tab.key === key));
        tab.button.tabIndex = tab.key === key ? 0 : -1;
    }
    document.getElementById('studio-test-controls')?.setAttribute('aria-labelledby', `studio-test-tab-${key}`);
}

function studioTestActionLabel(source) {
    if(source.dataset.color)return source.getAttribute('aria-label')||source.dataset.color;
    if (source.dataset.team !== undefined) {
        const kind = source.dataset.kind || source.dataset.action;
        return ({like:'+1 like', like25:'+25 likes', likes:'+100 likes', gift:source.dataset.action ? '+100 pct.' : 'Cadou'})[kind] || source.textContent;
    }
    const pressed = source.getAttribute('aria-pressed') === 'true';
    const labels = {
        pause:/resume|▶/i.test(source.textContent) ? 'Reia cursa' : 'Pauză',
        reset:'Cursă nouă', nextRace:'Cursa următoare',
        auto:/OFF/i.test(source.textContent) ? 'Simulare: oprită' : 'Simulare: pornită',
        demo:/OFF/i.test(source.textContent) ? 'Simulare: oprită' : 'Simulare: pornită',
        sound:/OFF/i.test(source.textContent) ? 'Sunet oprit' : 'Sunet pornit',
        christmasToggle:pressed ? 'Crăciun activ' : 'Mod Crăciun',
        randomWeather:pressed ? 'Vreme aleatorie: da' : 'Vreme aleatorie: nu',
        defaultMusic:'Muzica originală', resetSupporters:'Resetează clasamentul', resetTops:'Resetează clasamentul', sendChat:'Trimite comentariul'
    };
    return labels[source.id] || source.textContent;
}

function addStudioTestControl(group, source, labelText) {
    if (!source || !studioTestBridge) return;
    const tag = source.tagName.toLowerCase();
    const proxy = document.createElement(tag);
    proxy.className = tag === 'button' ? 'studio-test-action' : 'studio-test-input';
    if (source.id) proxy.dataset.testControl = source.id;
    for (const key of ['type', 'min', 'max', 'step', 'accept', 'maxlength', 'placeholder']) {
        if (source.hasAttribute(key)) proxy.setAttribute(key, source.getAttribute(key));
    }
    if (tag === 'button') {
        proxy.type = 'button';
        if(source.dataset.action)proxy.dataset.testAction=source.dataset.action;
        if (source.dataset.team !== undefined) proxy.dataset.testTeam = source.dataset.team;
        proxy.addEventListener('click', () => {
            if (!studioTestBridge || !source.isConnected) return;
            source.click();
            syncStudioTestMenu();
        });
    } else {
        if (tag === 'select') {
            for (const option of source.options) {
                const item = document.createElement('option');
                item.value = option.value;
                item.textContent = option.textContent;
                item.disabled = option.disabled;
                proxy.append(item);
            }
        }
        for (const eventType of ['input', 'change']) {
            proxy.addEventListener(eventType, () => {
                if (!studioTestBridge || !source.isConnected) return;
                try {
                    if (source.type === 'file') source.files = proxy.files;
                    else if (source.type === 'checkbox') source.checked = proxy.checked;
                    else source.value = proxy.value;
                    source.dispatchEvent(new studioTestBridge.frame.contentWindow.Event(eventType, {bubbles: true}));
                    syncStudioTestMenu();
                } catch {
                    document.getElementById('studio-test-feedback').textContent = 'Comanda nu a putut fi aplicată. Încearcă din nou.';
                }
            });
        }
        if (source.tagName === 'INPUT') proxy.addEventListener('keydown', event => {
            if (event.key === 'Enter' && studioTestBridge) {
                event.preventDefault();
                source.dispatchEvent(new studioTestBridge.frame.contentWindow.KeyboardEvent('keydown', {key:'Enter', bubbles:true}));
                syncStudioTestMenu();
            }
        });
    }
    if(source.matches?.('.gift-button')){
        proxy.classList.add('studio-test-gift');
        const image=document.createElement('canvas');image.width=image.height=64;image.setAttribute('aria-hidden','true');image.getContext('2d').drawImage(source.querySelector('canvas'),0,0);
        const copy=document.createElement('span'),title=document.createElement('strong'),amount=document.createElement('small');
        copy.append(title,amount);proxy.append(image,copy);proxy.giftCopy={title,amount};
    }
    if(source.hasAttribute('aria-label'))proxy.setAttribute('aria-label',source.getAttribute('aria-label'));
    if (labelText) {
        const label = document.createElement('label');
        label.className = `studio-test-field studio-test-field--${source.type || 'select'}`;
        const title = document.createElement('span');
        title.textContent = labelText;
        label.append(title, proxy);
        if (source.type === 'range') {
            const value = document.createElement('output');
            label.append(value);
            studioTestBridge.pairs.push({source, proxy, value});
        } else studioTestBridge.pairs.push({source, proxy});
        group.append(label);
    } else {
        group.append(proxy);
        studioTestBridge.pairs.push({source, proxy});
    }
    return proxy;
}

function buildStudioTestControls(original) {
    const doc = studioTestBridge.gameDocument;
    const add = (group, id, label) => addStudioTestControl(group, doc.getElementById(id), label);
    const teams = createStudioTestGroup('Teste pe echipe', 'teams');
    add(teams, 'giftValue', 'Valoare cadou');
    const rows = new Map();
    for (const source of original.querySelectorAll('button[data-team]')) {
        const team = source.dataset.team;
        if (!rows.has(team)) {
            const row = document.createElement('div');
            row.className = 'studio-test-team-row';
            row.dataset.testTeam = team;
            const name = document.createElement('span');
            name.className = 'studio-test-team-name';
            name.textContent = ({0:'RED',1:'BLUE',2:'GREEN'})[team] || `Echipa ${Number(team)+1}`;
            row.append(name);
            teams.append(row);
            rows.set(team, row);
        }
        addStudioTestControl(rows.get(team), source);
    }
    add(teams, 'speedInfo');
    const race = createStudioTestGroup('Control cursă', 'race', 'common');
    for (const id of ['pause', 'reset', 'auto', 'demo', 'nextRace']) add(race, id);
    add(race, 'autoNext', 'Pornește automat cursa următoare');
    const weather = createStudioTestGroup('Vreme și decor', 'weather');
    add(weather, 'timeOfDay', 'Momentul zilei');
    add(weather, 'weatherMode', 'Vreme');
    add(weather, 'christmasToggle');
    add(weather, 'randomWeather');
    const audio = createStudioTestGroup('Sunetele jocului', 'audio');
    add(audio, 'sound');
    const volumes = {volumeMaster:'Volum general', volumeMusic:'Muzică', volumeEngine:'Motor', volumeEffects:'Efecte', volume:'Volum general', crowdVolume:'Public', hoofVolume:'Copite', musicVolume:'Muzică'};
    for (const [id, label] of Object.entries(volumes)) add(audio, id, label);
    add(audio, 'commentary', 'Comentatorul cursei');
    add(audio, 'voiceStatus');
    const music = createStudioTestGroup('Muzică personalizată', 'music');
    add(music, 'customMusicFile', 'Alege un fișier audio');
    add(music, 'musicFile', 'Alege un fișier audio');
    add(music, 'defaultMusic');
    add(music, 'customMusicStatus');
    add(music, 'musicName');
    studioTestBridge.groups = studioTestBridge.groups.filter(group => {
        const populated = group.section.children[1].children.length > 0;
        group.section.hidden = !populated;
        return populated;
    });
    initializeStudioTestTabs();
}

function syncStudioTestMenu() {
    if (!studioTestBridge) return;
    for (const {source, proxy, value} of studioTestBridge.pairs) {
        proxy.disabled = source.disabled || false;
        const tag = source.tagName;
        if (['INPUT','SELECT','TEXTAREA'].includes(tag)) {
            if (source.type === 'checkbox') proxy.checked = source.checked;
            else if (source.type === 'file') { if (!source.value && proxy.value) proxy.value = ''; }
            else if (document.activeElement !== proxy) proxy.value = source.value;
            if (value) value.textContent = `${source.value}%`;
            if (proxy.setCustomValidity && source.validity) proxy.setCustomValidity(source.validity.customError ? source.validationMessage : '');
        } else {
            const text = tag === 'BUTTON' ? studioTestActionLabel(source) : source.textContent;
            if(proxy.giftCopy){proxy.giftCopy.title.textContent=source.querySelector('strong').textContent;proxy.giftCopy.amount.textContent=source.querySelector('small').textContent;}
            else if (proxy.textContent !== text) proxy.textContent = text;
            if (tag === 'BUTTON' && source.dataset.team !== undefined) {
                const team = ({0:'RED',1:'BLUE',2:'GREEN'})[source.dataset.team] || source.dataset.team;
                proxy.setAttribute('aria-label', `${team}: ${text}`);
            }
        }
        if (source.hasAttribute('aria-pressed')) proxy.setAttribute('aria-pressed', source.getAttribute('aria-pressed'));
        if (source.hasAttribute('aria-checked')) proxy.setAttribute('aria-checked', source.getAttribute('aria-checked'));
    }
}

function initializeActionGameTestMenu(frame,doc){
    studioTestBridge={frame,gameDocument:doc,pairs:[],groups:[],tabs:[],api:frame.contentWindow.TikInteractStudioControls};
    const api=studioTestBridge.api,add=(group,id,label)=>addStudioTestControl(group,doc.getElementById(id),label);
    document.getElementById('studio-test-game-name').textContent=document.getElementById('live-game-select').selectedOptions[0].textContent;
    const gifts=createStudioTestGroup('Cadouri de test','native-gifts','teams');
    add(gifts,'viewer','Spectator');add(gifts,'gift-quantity','Cantitate');
    const grid=document.createElement('div');grid.className='studio-test-gift-grid';gifts.append(grid);
    for(const source of doc.querySelectorAll('#gift-buttons .gift-button'))addStudioTestControl(grid,source);
    const control=createStudioTestGroup('Control joc','race','teams');add(control,'pause');
    const restart=doc.createElement('button');restart.textContent='Rundă nouă';restart.type='button';restart.hidden=true;
    restart.addEventListener('click',()=>api.control({action:'session.restart'}));doc.getElementById('test-panel').append(restart);addStudioTestControl(control,restart);
    add(control,'autoplay-input','Urcare automată');
    const appearance=createStudioTestGroup('Personaj și peisaj','appearance','appearance');
    add(appearance,'background-input','Peisaj');add(appearance,'detail-input','Intensitate efecte');
    const colors=document.createElement('div');colors.className='studio-native-colors';appearance.append(colors);
    for(const source of doc.querySelectorAll('[data-color]')){const proxy=addStudioTestControl(colors,source);proxy.style.cssText=source.style.cssText;proxy.textContent=source.dataset.color;}
    const audio=createStudioTestGroup('Sunetele jocului','audio','audio');
    add(audio,'sound');add(audio,'fx-volume','Efecte sonore');add(audio,'music-volume','Muzică');add(audio,'music-input','Muzică activă');
    const bindings=createStudioTestGroup('Cadouri TikTok → acțiuni','bindings','gifts');
    buildActionGameGiftBindings(bindings,studioTestBridge);
    initializeStudioTestTabs();syncStudioTestMenu();
    document.getElementById('studio-test-panel').setAttribute('aria-busy','false');
    studioTestSyncTimer=setInterval(()=>{if(!document.hidden)syncStudioTestMenu();},300);
}

async function buildActionGameGiftBindings(root,bridge){
    const note=document.createElement('p');note.className='studio-test-note';note.textContent='Asociază cadouri cu acțiuni. Cantitatea repetă efectul; cadourile neasociate sunt ignorate. Setările se păstrează în browser.';root.append(note);
    const search=document.createElement('input');search.type='search';search.className='studio-test-input';search.placeholder='Caută un cadou sau ID';search.setAttribute('aria-label','Caută în cadourile TikTok');root.append(search);
    const refresh=document.createElement('button');refresh.type='button';refresh.className='studio-test-action';refresh.textContent='Actualizează lista';root.append(refresh);
    const list=document.createElement('div');list.className='studio-gift-bindings';root.append(list);
    let catalog=[];
    const paint=()=>{
        const query=search.value.trim().toLocaleLowerCase('ro'),assigned=bridge.api.getBindings();list.replaceChildren();
        for(const action of bridge.api.getDefinitions()){
            const label=document.createElement('label');label.className='studio-gift-binding';
            const title=document.createElement('span');title.textContent=action.name+(action.value?' · '+(action.value>0?'+':'−')+Math.abs(action.value)+(Math.abs(action.value)>1?' m':'' ):'');
            const row=document.createElement('div'),image=document.createElement('img'),select=document.createElement('select');image.alt='';image.hidden=true;image.referrerPolicy='no-referrer';image.onerror=()=>{image.hidden=true;};
            select.className='studio-test-input';select.dataset.giftBinding=action.id;select.setAttribute('aria-label','Cadou TikTok pentru '+action.name);
            const empty=document.createElement('option');empty.value='';empty.textContent='Fără cadou asociat';select.append(empty);
            const matching=catalog.filter(gift=>gift.id===assigned[action.id]||!query||`${gift.name} ${gift.id}`.toLocaleLowerCase('ro').includes(query));
            if(assigned[action.id]&&!matching.some(gift=>gift.id===assigned[action.id]))matching.unshift({id:assigned[action.id],name:'Cadou ID '+assigned[action.id],coins:0});
            for(const gift of matching){const option=document.createElement('option');option.value=gift.id;option.textContent=gift.name+' · '+gift.coins+' monede · #'+gift.id;select.append(option);}
            select.value=assigned[action.id]||'';
            const showImage=()=>{const gift=catalog.find(gift=>gift.id===select.value);image.hidden=!gift?.image;if(gift?.image&&gift.image.startsWith('https://'))image.src=gift.image;};showImage();
            select.onchange=()=>{const result=bridge.api.setBinding(action.id,select.value);if(!result.ok){select.value=assigned[action.id]||'';document.getElementById('studio-test-feedback').textContent=result.message;}else{assigned[action.id]=select.value;document.getElementById('studio-test-feedback').textContent='Asocierea a fost salvată.';}showImage();};
            row.append(image,select);label.append(title,row);list.append(label);
        }
    };
    const load=async()=>{
        refresh.disabled=true;
        try{
            const response=await fetch('assets/tiktok-gifts-catalog.json');if(!response.ok)throw Error();const bundled=await response.json();
            let synced=[];try{synced=JSON.parse(localStorage.getItem('tikinteract-gift-catalog-v1')||'{}').gifts||[];}catch{}
            catalog=[...new Map([...bundled.gifts,...synced].map(gift=>[String(gift.id),{...gift,id:String(gift.id)}])).values()].sort((a,b)=>a.coins-b.coins||a.name.localeCompare(b.name));
            if(studioTestBridge!==bridge)return;paint();
        }catch{if(studioTestBridge===bridge)note.textContent='Lista nu s-a putut încărca. Apasă Actualizează lista.';}
        finally{refresh.disabled=false;}
    };
    search.oninput=paint;refresh.onclick=load;await load();
}

