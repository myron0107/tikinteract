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

function createStudioTestGroup(title, kind = '', category = kind || 'extra') {
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
    const categories = [['teams','Test'],['weather','Decor'],['audio','Audio'],['music','Muzică'],['extra','Extra']];
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
    if (doc.getElementById('chatUser')) {
        const chat = createStudioTestGroup('Test comentarii');
        add(chat, 'chatUser', 'Nume spectator');
        add(chat, 'chatMessage', 'Comandă echipă');
        add(chat, 'sendChat');
    }
    const ranks = createStudioTestGroup('Clasamentul jocului');
    add(ranks, 'resetSupporters');
    add(ranks, 'resetTops');
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
            if (proxy.textContent !== text) proxy.textContent = text;
            if (tag === 'BUTTON' && source.dataset.team !== undefined) {
                const team = ({0:'RED',1:'BLUE',2:'GREEN'})[source.dataset.team] || source.dataset.team;
                proxy.setAttribute('aria-label', `${team}: ${text}`);
            }
        }
        if (source.hasAttribute('aria-pressed')) proxy.setAttribute('aria-pressed', source.getAttribute('aria-pressed'));
    }
}

