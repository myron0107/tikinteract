let totalScore = 0;
let items = [];
let socket = null;
let giftCount = 0;
let connectedUsername = null;
let platformSessionActive = false;
let platformSessionPromise = null;
let leaderboardRefreshTimer = null;
let leaderboardPeriod = 'all';
let leaderboardRequestId = 0;
const soundEffectCatalog = [
    ['Applause', 'sfx'], ['Celebration', 'sfx'], ['Audience laugh', 'sfx'], ['Epic fail', 'sfx'],
    ['Big impact', 'sfx'], ['Whoosh', 'sfx'], ['Suspense', 'sfx'], ['Coin drop', 'sfx'],
    ['Level up', 'sfx'], ['Laser', 'sfx'], ['Power boost', 'sfx'], ['Glitch', 'sfx'],
    ['Ping', 'sfx'], ['Pop drop', 'sfx'], ['Victory', 'sfx'], ['Impact', 'sfx'],
    ['Switch', 'sfx'], ['Spark', 'sfx'], ['Alert', 'sfx'], ['Arcade intro', 'sfx'],
    ['Arcade victory', 'sfx'], ['Pizzicato interlude', 'sfx'], ['Cipher', 'sfx'],
    ['E lutador', 'meme'], ['Ack', 'meme'], ['Am trei rânduri de creier', 'meme'],
    ['Anime Ahh', 'meme'], ['Apple Pay', 'meme'], ['Baby laughing', 'meme'],
    ['Cat laugh', 'meme'], ['Core', 'meme'], ['Dry fart', 'meme'], ['Dun dun dun', 'meme'],
    ['Emotional damage', 'meme'], ['Error', 'meme'], ['Fah!', 'meme'], ['Indian song', 'meme'],
    ['Levántense', 'meme'], ['Made in Romania', 'meme'], ['Meow', 'meme'],
    ['Me perdonas', 'meme'], ['Movie', 'meme'], ['NY audio', 'meme'],
    ['Oh my God bro', 'meme'], ['Perfect fart', 'meme'], ['Piuw', 'meme'],
    ['Pou', 'meme'], ['Pump shotgun', 'meme'], ['Rizz', 'meme'], ['Șarpili', 'meme'],
    ['Spiderman', 'meme'], ['SpongeBob fail', 'meme'], ['Sukuna gugu gaga', 'meme'],
    ['TF Nemesis', 'meme'], ['Tuco Get Out', 'meme'], ['Vine boom', 'meme']
].map(([name, category], index) => ({
    id: `sound-${String(index + 1).padStart(2, '0')}`,
    name,
    category
}));

const SOUND_LIBRARY_DB = 'tikinteract-audio-library';
const SOUND_LIBRARY_STORE = 'sound-effects';
const MAX_SOUND_FILE_SIZE = 25 * 1024 * 1024;
let soundLibraryDatabasePromise = null;
let loadedSoundEffects = new Map();
let activeSoundEffectId = null;
let soundMasterVolume = 0.75;

const leaderboardPeriods = {
    all: 'Clasament all-time',
    '24h': 'Clasament ultimele 24 de ore',
    '7d': 'Clasament ultimele 7 zile',
    '30d': 'Clasament ultimele 30 de zile'
};

function setLeaderboardStatus(message, isError = false) {
    const status = document.getElementById('leaderboard-status');
    if (!status) return;
    status.textContent = message;
    status.className = `mb-5 text-sm ${isError ? 'text-amber-400' : 'text-zinc-400'}`;
}

function formatLiveTime(seconds) {
    const totalMinutes = Math.floor(Number(seconds || 0) / 60);
    const hours = Math.floor(totalMinutes / 60);
    const minutes = totalMinutes % 60;
    return hours ? `${hours} h ${minutes} min` : `${minutes} min`;
}

function openSoundLibraryDatabase() {
    if (soundLibraryDatabasePromise) return soundLibraryDatabasePromise;
    if (!window.indexedDB) return Promise.reject(new Error('Stocarea audio locală nu este disponibilă în acest browser.'));

    soundLibraryDatabasePromise = new Promise((resolve, reject) => {
        const request = window.indexedDB.open(SOUND_LIBRARY_DB, 1);
        request.onupgradeneeded = () => {
            if (!request.result.objectStoreNames.contains(SOUND_LIBRARY_STORE)) {
                request.result.createObjectStore(SOUND_LIBRARY_STORE, { keyPath: 'id' });
            }
        };
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error || new Error('Nu am putut deschide biblioteca audio locală.'));
        request.onblocked = () => reject(new Error('Închide celelalte file TikInteract și încearcă din nou.'));
    }).catch((error) => {
        soundLibraryDatabasePromise = null;
        throw error;
    });
    return soundLibraryDatabasePromise;
}

function runSoundLibraryTransaction(mode, operation) {
    return openSoundLibraryDatabase().then((database) => new Promise((resolve, reject) => {
        const transaction = database.transaction(SOUND_LIBRARY_STORE, mode);
        const request = operation(transaction.objectStore(SOUND_LIBRARY_STORE));
        let result;
        if (request) {
            request.onsuccess = () => { result = request.result; };
            request.onerror = () => reject(request.error || new Error('Nu am putut accesa fișierul audio.'));
        }
        transaction.oncomplete = () => resolve(result);
        transaction.onerror = () => reject(transaction.error || new Error('Nu am putut salva biblioteca audio.'));
        transaction.onabort = () => reject(transaction.error || new Error('Operația din biblioteca audio a fost anulată.'));
    }));
}

function setSoundLibraryStatus(message, isError = false) {
    const status = document.getElementById('audio-center-status');
    if (!status) return;
    status.textContent = message;
    status.classList.toggle('is-error', isError);
}

function renderSoundEffectCards() {
    const grid = document.getElementById('audio-sound-grid');
    if (!grid) return;
    grid.replaceChildren();

    soundEffectCatalog.forEach((sound) => {
        const card = document.createElement('article');
        card.className = 'audio-sound-card';
        card.dataset.soundId = sound.id;
        card.dataset.category = sound.category;

        const cardHeading = document.createElement('div');
        cardHeading.className = 'audio-sound-card-heading';
        const icon = document.createElement('span');
        icon.className = 'audio-sound-icon';
        icon.innerHTML = sound.category === 'sfx'
            ? '<i class="fa-solid fa-wave-square" aria-hidden="true"></i>'
            : '<i class="fa-solid fa-microphone-lines" aria-hidden="true"></i>';
        const name = document.createElement('h4');
        name.textContent = sound.name;
        cardHeading.append(icon, name);

        const fileName = document.createElement('p');
        fileName.className = 'audio-sound-file-name';
        fileName.textContent = 'Nu este încărcat';
        fileName.dataset.soundFileName = '';

        const controls = document.createElement('div');
        controls.className = 'audio-sound-controls';
        const playButton = document.createElement('button');
        playButton.type = 'button';
        playButton.className = 'audio-sound-play';
        playButton.dataset.soundPlay = '';
        playButton.disabled = true;
        playButton.setAttribute('aria-label', `Redă ${sound.name}`);
        playButton.innerHTML = '<i class="fa-solid fa-play" aria-hidden="true"></i><span>Redă</span>';
        playButton.addEventListener('click', () => playSoundEffect(sound.id));

        const uploadButton = document.createElement('button');
        uploadButton.type = 'button';
        uploadButton.className = 'audio-sound-upload';
        uploadButton.setAttribute('aria-label', `Încarcă audio pentru ${sound.name}`);
        uploadButton.title = `Încarcă audio pentru ${sound.name}`;
        uploadButton.innerHTML = '<i class="fa-solid fa-upload" aria-hidden="true"></i><span>Încarcă</span>';

        const fileInput = document.createElement('input');
        fileInput.type = 'file';
        fileInput.accept = 'audio/*,.mp3,.wav,.ogg,.m4a,.aac,.flac,.webm';
        fileInput.hidden = true;
        fileInput.setAttribute('aria-label', `Încarcă un fișier audio pentru ${sound.name}`);
        fileInput.addEventListener('change', () => {
            const [file] = fileInput.files || [];
            fileInput.value = '';
            if (file) saveSoundEffect(sound.id, file);
        });
        uploadButton.addEventListener('click', () => fileInput.click());

        controls.append(playButton, uploadButton, fileInput);
        card.append(cardHeading, fileName, controls);
        grid.append(card);
    });

    filterSoundEffects();
}

function updateSoundEffectCard(soundId, savedName = null, isPlaying = false) {
    const card = document.querySelector(`[data-sound-id="${soundId}"]`);
    if (!card) return;
    const name = card.querySelector('[data-sound-file-name]');
    const playButton = card.querySelector('[data-sound-play]');
    if (name) name.textContent = savedName || 'Nu este încărcat';
    if (playButton) {
        playButton.disabled = !savedName;
        playButton.classList.toggle('is-playing', isPlaying);
        playButton.setAttribute('aria-label', `${isPlaying ? 'Oprește' : 'Redă'} ${card.querySelector('h4')?.textContent || 'sunet'}`);
        playButton.innerHTML = isPlaying
            ? '<i class="fa-solid fa-stop" aria-hidden="true"></i><span>Oprește</span>'
            : '<i class="fa-solid fa-play" aria-hidden="true"></i><span>Redă</span>';
    }
}

async function loadSoundEffectLibrary() {
    renderSoundEffectCards();
    const savedEffects = await runSoundLibraryTransaction('readonly', (store) => store.getAll());
    loadedSoundEffects.forEach(({ player, objectUrl }) => {
        player.pause();
        URL.revokeObjectURL(objectUrl);
    });
    loadedSoundEffects = new Map();

    savedEffects.forEach((sound) => {
        if (!sound.blob || !soundLibraryCatalogHas(sound.id)) return;
        const objectUrl = URL.createObjectURL(sound.blob);
        const player = new Audio(objectUrl);
        player.preload = 'metadata';
        player.volume = soundMasterVolume;
        player.addEventListener('ended', () => {
            if (activeSoundEffectId === sound.id) activeSoundEffectId = null;
            updateSoundEffectCard(sound.id, sound.name, false);
        });
        player.addEventListener('error', () => {
            if (activeSoundEffectId === sound.id) activeSoundEffectId = null;
            updateSoundEffectCard(sound.id, sound.name, false);
            setSoundLibraryStatus(`Fișierul „${sound.name}” nu poate fi redat. Încarcă un fișier audio valid.`, true);
        });
        loadedSoundEffects.set(sound.id, { player, objectUrl, name: sound.name });
        updateSoundEffectCard(sound.id, sound.name);
    });

    setSoundLibraryStatus(`Bibliotecă pregătită. ${loadedSoundEffects.size} din ${soundEffectCatalog.length} sunete au fișiere încărcate.`);
}

function soundLibraryCatalogHas(soundId) {
    return soundEffectCatalog.some((sound) => sound.id === soundId);
}

async function saveSoundEffect(soundId, file) {
    const sound = soundEffectCatalog.find((entry) => entry.id === soundId);
    if (!sound) return;
    if (!file.type.startsWith('audio/') && !/\.(mp3|wav|ogg|m4a|aac|flac|webm)$/i.test(file.name)) {
        setSoundLibraryStatus('Alege un fișier audio, de exemplu MP3, WAV, OGG, M4A sau FLAC.', true);
        return;
    }
    if (file.size > MAX_SOUND_FILE_SIZE) {
        setSoundLibraryStatus('Fișierul este prea mare. Limita este de 25 MB pentru fiecare sunet.', true);
        return;
    }
    if (file.size === 0) {
        setSoundLibraryStatus('Fișierul audio este gol. Alege alt fișier.', true);
        return;
    }

    setSoundLibraryStatus(`Se salvează „${sound.name}” în browser...`);
    try {
        const savedSound = { id: soundId, name: file.name, blob: file, savedAt: Date.now() };
        await runSoundLibraryTransaction('readwrite', (store) => store.put(savedSound));
        const previous = loadedSoundEffects.get(soundId);
        if (previous) {
            previous.player.pause();
            URL.revokeObjectURL(previous.objectUrl);
        }

        const objectUrl = URL.createObjectURL(file);
        const player = new Audio(objectUrl);
        player.preload = 'metadata';
        player.volume = soundMasterVolume;
        player.addEventListener('ended', () => {
            if (activeSoundEffectId === soundId) activeSoundEffectId = null;
            updateSoundEffectCard(soundId, file.name, false);
        });
        player.addEventListener('error', () => {
            if (activeSoundEffectId === soundId) activeSoundEffectId = null;
            updateSoundEffectCard(soundId, file.name, false);
            setSoundLibraryStatus(`Fișierul „${file.name}” nu poate fi redat. Încearcă alt format audio.`, true);
        });
        loadedSoundEffects.set(soundId, { player, objectUrl, name: file.name });
        updateSoundEffectCard(soundId, file.name);
        filterSoundEffects();
        setSoundLibraryStatus(`„${sound.name}” a fost salvat local pe acest dispozitiv.`);
    } catch (error) {
        console.error('Could not save sound effect to local library:', error);
        setSoundLibraryStatus(`Nu am putut salva „${sound.name}”: ${error.message}`, true);
    }
}

async function playSoundEffect(soundId) {
    const sound = loadedSoundEffects.get(soundId);
    if (!sound) {
        setSoundLibraryStatus('Încarcă mai întâi un fișier audio pentru acest sunet.');
        return;
    }
    if (activeSoundEffectId === soundId && !sound.player.paused) {
        sound.player.pause();
        sound.player.currentTime = 0;
        activeSoundEffectId = null;
        updateSoundEffectCard(soundId, sound.name, false);
        return;
    }

    stopAllSoundEffects();
    sound.player.currentTime = 0;
    sound.player.volume = soundMasterVolume;
    try {
        await sound.player.play();
        activeSoundEffectId = soundId;
        updateSoundEffectCard(soundId, sound.name, true);
        setSoundLibraryStatus(`Se redă „${soundEffectCatalog.find((entry) => entry.id === soundId)?.name || sound.name}”.`);
    } catch (error) {
        console.error('Could not play sound effect:', error);
        setSoundLibraryStatus(`Nu am putut reda sunetul: ${error.message}`, true);
    }
}

function stopAllSoundEffects() {
    loadedSoundEffects.forEach(({ player, name }, soundId) => {
        player.pause();
        player.currentTime = 0;
        updateSoundEffectCard(soundId, name, false);
    });
    activeSoundEffectId = null;
}

function setAudioMasterVolume(value) {
    const parsedVolume = Number(value);
    if (!Number.isFinite(parsedVolume)) return;
    soundMasterVolume = Math.max(0, Math.min(1, parsedVolume / 100));
    loadedSoundEffects.forEach(({ player }) => { player.volume = soundMasterVolume; });
    const display = document.getElementById('audio-master-volume-value');
    if (display) display.textContent = `${Math.round(soundMasterVolume * 100)}%`;
}

function filterSoundEffects() {
    const search = document.getElementById('audio-sound-search')?.value.trim().toLocaleLowerCase() || '';
    const category = document.getElementById('audio-sound-category')?.value || 'all';
    let visibleCount = 0;
    document.querySelectorAll('.audio-sound-card').forEach((card) => {
        const matches = card.querySelector('h4')?.textContent.toLocaleLowerCase().includes(search) || false;
        const categoryMatches = category === 'all' || card.dataset.category === category;
        const visible = matches && categoryMatches;
        card.classList.toggle('hidden', !visible);
        if (visible) visibleCount += 1;
    });

    const count = document.getElementById('audio-library-count');
    if (count) count.textContent = `${visibleCount} sunete`;
}

function setLiveStudioTab(tab) {
    const isAudio = tab === 'audio';
    const studioPanel = document.getElementById('live-studio-panel');
    const audioPanel = document.getElementById('audio-center-panel');
    const studioTab = document.getElementById('live-studio-tab');
    const audioTab = document.getElementById('audio-center-tab');
    if (!studioPanel || !audioPanel || !studioTab || !audioTab) return;

    studioPanel.classList.toggle('hidden', isAudio);
    audioPanel.classList.toggle('hidden', !isAudio);
    studioTab.classList.toggle('is-active', !isAudio);
    audioTab.classList.toggle('is-active', isAudio);
    studioTab.setAttribute('aria-selected', String(!isAudio));
    audioTab.setAttribute('aria-selected', String(isAudio));
    if (isAudio) document.getElementById('audio-sound-search')?.focus();
}

function createLeaderboardPerson(profile, rank) {
    const person = document.createElement('div');
    person.className = 'leaderboard-person';

    const avatar = document.createElement('div');
    avatar.className = 'leaderboard-avatar';
    avatar.textContent = String(profile.tiktok_display_name || profile.tiktok_username || '?').charAt(0).toUpperCase();

    let safeAvatarUrl = null;
    try {
        const url = new URL(profile.avatar_url);
        if (url.protocol === 'https:') safeAvatarUrl = url.href;
    } catch {
        safeAvatarUrl = null;
    }
    if (safeAvatarUrl) {
        const image = document.createElement('img');
        image.src = safeAvatarUrl;
        image.alt = '';
        image.loading = 'lazy';
        image.referrerPolicy = 'no-referrer';
        image.addEventListener('load', () => avatar.classList.add('has-image'), { once: true });
        image.addEventListener('error', () => image.remove(), { once: true });
        avatar.append(image);
    }

    const details = document.createElement('div');
    details.className = 'min-w-0';
    const link = document.createElement('a');
    link.href = `https://www.tiktok.com/@${encodeURIComponent(profile.tiktok_username)}`;
    link.target = '_blank';
    link.rel = 'noopener noreferrer';
    link.textContent = profile.tiktok_display_name || `@${profile.tiktok_username}`;
    link.setAttribute('aria-label', `Deschide profilul TikTok @${profile.tiktok_username}`);
    const handle = document.createElement('span');
    handle.textContent = `@${profile.tiktok_username}`;
    details.append(link, handle);
    person.append(avatar, details);

    if (rank) {
        const rankLabel = document.createElement('span');
        rankLabel.className = 'leaderboard-rank';
        rankLabel.textContent = `#${rank}`;
        person.prepend(rankLabel);
    }
    return person;
}

function renderLeaderboard(rows) {
    const podium = document.getElementById('leaderboard-podium');
    const list = document.getElementById('leaderboard-list');
    const empty = document.getElementById('leaderboard-empty');
    if (!podium || !list || !empty) return;

    podium.replaceChildren();
    list.replaceChildren();
    empty.classList.toggle('hidden', rows.length > 0);

    rows.slice(0, 3).forEach((profile, index) => {
        const rank = index + 1;
        const card = document.createElement('article');
        card.className = `leaderboard-top-card leaderboard-top-${rank}`;
        const label = document.createElement('p');
        label.className = 'leaderboard-top-label';
        label.textContent = rank === 1 ? 'Streamer #1' : `Locul ${rank}`;
        const person = createLeaderboardPerson(profile);
        const coins = document.createElement('strong');
        coins.className = 'leaderboard-top-coins';
        coins.textContent = Number(profile.total_coins || 0).toLocaleString('ro-RO');
        const coinsLabel = document.createElement('span');
        coinsLabel.className = 'leaderboard-top-caption';
        coinsLabel.textContent = 'monede';
        const time = document.createElement('span');
        time.className = 'leaderboard-top-time';
        time.textContent = formatLiveTime(profile.total_live_seconds);
        card.append(label, person, coins, coinsLabel, time);
        podium.append(card);
    });

    rows.forEach((profile, index) => {
        const row = document.createElement('tr');
        const rankCell = document.createElement('td');
        rankCell.className = 'leaderboard-position';
        rankCell.textContent = `#${index + 1}`;
        const streamerCell = document.createElement('td');
        streamerCell.append(createLeaderboardPerson(profile));
        const coinCell = document.createElement('td');
        coinCell.className = 'leaderboard-number';
        coinCell.textContent = Number(profile.total_coins || 0).toLocaleString('ro-RO');
        const timeCell = document.createElement('td');
        timeCell.className = 'leaderboard-number';
        timeCell.textContent = formatLiveTime(profile.total_live_seconds);
        row.append(rankCell, streamerCell, coinCell, timeCell);
        list.append(row);
    });
}

async function loadLeaderboard() {
    const supabase = window.tikInteractSupabase;
    const list = document.getElementById('leaderboard-list');
    if (!list) return;

    const requestId = ++leaderboardRequestId;
    if (!supabase) {
        setLeaderboardStatus('Nu s-a putut inițializa Supabase. Reîncarcă pagina și încearcă din nou.', true);
        return;
    }

    setLeaderboardStatus('Se încarcă clasamentul...');
    try {
        const { data, error } = await supabase.rpc('get_streamer_leaderboard', {
            p_period: leaderboardPeriod
        });
        if (error) throw error;
        if (requestId !== leaderboardRequestId) return;

        const rows = data || [];
        renderLeaderboard(rows);
        setLeaderboardStatus(rows.length
            ? `Afișăm ${rows.length} profiluri publice · ${leaderboardPeriods[leaderboardPeriod].toLowerCase()}.`
            : leaderboardPeriod === 'all'
                ? 'Nu există încă profiluri publice. Fii primul streamer din clasament!'
                : `Nu există activitate în ${leaderboardPeriod === '24h' ? 'ultimele 24 de ore' : `ultimele ${leaderboardPeriod === '7d' ? '7 zile' : '30 de zile'}`}.`);
    } catch (error) {
        if (requestId !== leaderboardRequestId) return;
        renderLeaderboard([]);
        document.getElementById('leaderboard-empty')?.classList.add('hidden');
        setLeaderboardStatus(
            `Clasamentul nu s-a putut încărca: ${error.message}. Rulează supabase/leaderboard_periods.sql în Supabase.`,
            true
        );
    }
}

async function loadHomeLeaderboard() {
    const list = document.getElementById('home-leaderboard-list');
    const status = document.getElementById('home-leaderboard-status');
    const supabase = window.tikInteractSupabase;
    if (!list || !status) return;
    if (!supabase) {
        status.textContent = 'Clasamentul nu este disponibil momentan. Reîncarcă pagina pentru a încerca din nou.';
        status.classList.add('is-error');
        return;
    }

    status.textContent = 'Se încarcă topul comunității...';
    status.classList.remove('is-error');
    try {
        const { data, error } = await supabase.rpc('get_streamer_leaderboard', {
            p_period: 'all'
        });
        if (error) throw error;

        const rows = (data || []).slice(0, 10);
        list.replaceChildren();
        rows.forEach((profile, index) => {
            const row = document.createElement('li');
            row.className = 'home-leaderboard-row';

            const rank = document.createElement('span');
            rank.className = `home-leaderboard-rank${index < 3 ? ` is-top-${index + 1}` : ''}`;
            rank.textContent = String(index + 1).padStart(2, '0');

            const person = createLeaderboardPerson(profile);
            person.classList.add('home-leaderboard-person');

            const coins = document.createElement('strong');
            coins.className = 'home-leaderboard-coins';
            coins.textContent = Number(profile.total_coins || 0).toLocaleString('ro-RO');

            const liveTime = document.createElement('span');
            liveTime.className = 'home-leaderboard-time';
            liveTime.textContent = formatLiveTime(profile.total_live_seconds);

            row.append(rank, person, coins, liveTime);
            list.append(row);
        });

        status.textContent = rows.length
            ? `Top ${rows.length} · Clasament all-time`
            : 'Clasamentul se va completa când streamerii își publică profilul și pornesc un LIVE prin TikInteract.';
    } catch (error) {
        console.error('Failed to load the home page leaderboard:', error);
        status.textContent = `Topul nu s-a putut încărca: ${error.message}`;
        status.classList.add('is-error');
    }
}

function setLeaderboardPeriod(period) {
    if (!Object.hasOwn(leaderboardPeriods, period)) return;
    leaderboardPeriod = period;
    document.querySelectorAll('[data-leaderboard-period]').forEach((button) => {
        const isActive = button.dataset.leaderboardPeriod === period;
        button.setAttribute('aria-pressed', String(isActive));
        button.classList.toggle('is-active', isActive);
    });
    const label = document.getElementById('leaderboard-period-label');
    if (label) label.textContent = leaderboardPeriods[period];
    loadLeaderboard();
}

async function saveTikTokLeaderboardProfile(username, displayName = username, avatarUrl = null) {
    const supabase = window.tikInteractSupabase;
    if (!window.tikInteractUser || !supabase) {
        const status = document.getElementById('tiktok-sync-status');
        if (status) {
            status.textContent = 'Conectează-te la contul TikInteract pentru a salva profilul în clasament.';
            status.className = 'mb-4 text-[10px] font-bold uppercase tracking-[0.14em] text-amber-400';
        }
        return false;
    }

    const { error } = await supabase.rpc('save_my_streamer_profile', {
        p_tiktok_username: username.replace(/^@/, ''),
        p_tiktok_display_name: displayName || username.replace(/^@/, ''),
        p_avatar_url: avatarUrl,
        p_is_public: true
    });
    if (error) throw error;
    return true;
}

async function restoreMyStreamerProfile() {
    const supabase = window.tikInteractSupabase;
    const user = window.tikInteractUser;
    if (!supabase || !user) return;

    const { data, error } = await supabase
        .from('streamer_profiles')
        .select('tiktok_username,tiktok_display_name,avatar_url,is_public')
        .eq('user_id', user.id)
        .maybeSingle();
    if (error) throw error;

    let profile = data;
    if (!profile) {
        let savedUsername = null;
        try {
            savedUsername = localStorage.getItem('tikinteract_tiktok_user');
        } catch (storageError) {
            console.warn('Could not restore TikTok username from local storage:', storageError);
        }
        if (!savedUsername) return;

        const username = savedUsername.trim().replace(/^@/, '');
        await saveTikTokLeaderboardProfile(username);
        profile = {
            tiktok_username: username,
            tiktok_display_name: username,
            avatar_url: null,
            is_public: true
        };
    } else if (!profile.is_public) {
        await saveTikTokLeaderboardProfile(
            profile.tiktok_username,
            profile.tiktok_display_name,
            profile.avatar_url
        );
        profile.is_public = true;
    }

    const input = document.getElementById('tiktok-user');
    if (input) input.value = `@${profile.tiktok_username}`;
    setStreamerProfile(profile.tiktok_username, profile.avatar_url, profile.tiktok_display_name);
}

function saveTikTokProfileFromSettings() {
    const input = document.getElementById('tiktok-user');
    if (!input) return;
    const username = input.value.trim().replace(/^@/, '');
    saveTikTokLeaderboardProfile(username).then((isPublic) => {
        const status = document.getElementById('tiktok-sync-status');
        if (status && !connectedUsername) {
            status.textContent = isPublic
                ? 'Profilul și statisticile sunt publicate automat în clasament.'
                : 'Conectează-te la TikInteract pentru publicarea profilului în clasament.';
            status.className = `mb-4 text-[10px] font-bold uppercase tracking-[0.14em] ${isPublic ? 'text-green-400' : 'text-amber-400'}`;
        }
        loadLeaderboard();
    }).catch((error) => {
        const status = document.getElementById('tiktok-sync-status');
        if (status) {
            status.textContent = `Nu am putut salva profilul: ${error.message}`;
            status.className = 'mb-4 text-[10px] font-bold uppercase tracking-[0.14em] text-amber-400';
        }
    });
}

function startPlatformLiveSession(username) {
    if (platformSessionActive || platformSessionPromise) return;
    const supabase = window.tikInteractSupabase;
    if (!window.tikInteractUser || !supabase) {
        const status = document.getElementById('tiktok-sync-status');
        if (status) status.textContent = 'LIVE conectat, dar conectează-te la TikInteract pentru a salva statistici.';
        return;
    }

    platformSessionPromise = (async () => {
        const { error } = await supabase.rpc('start_my_live_session', {
            p_tiktok_username: username
        });
        if (error) throw error;
        platformSessionActive = true;
        const status = document.getElementById('tiktok-sync-status');
        if (status) {
            status.textContent = `Conectat la @${username}; statisticile se salvează.`;
            status.className = 'mb-4 text-[10px] font-bold uppercase tracking-[0.14em] text-green-400';
        }
    })().catch((error) => {
        const status = document.getElementById('tiktok-sync-status');
        if (status) {
            status.textContent = `LIVE conectat, dar statisticile nu se salvează: ${error.message}`;
            status.className = 'mb-4 text-[10px] font-bold uppercase tracking-[0.14em] text-amber-400';
        }
        console.error('Failed to start leaderboard LIVE session:', error);
    }).finally(() => {
        platformSessionPromise = null;
    });
}

async function finishPlatformLiveSession() {
    if (platformSessionPromise) await platformSessionPromise;
    if (!platformSessionActive) return;
    platformSessionActive = false;
    const supabase = window.tikInteractSupabase;
    if (!supabase) return;

    try {
        const { error } = await supabase.rpc('finish_my_live_session');
        if (error) throw error;
        loadLeaderboard();
    } catch (error) {
        console.error('Failed to finish leaderboard LIVE session:', error);
        setLeaderboardStatus(`Timpul LIVE nu s-a putut salva: ${error.message}`, true);
    }
}

async function recordLeaderboardGift(event) {
    if (!event.eventId || !event.coins) return;
    const supabase = window.tikInteractSupabase;
    if (!window.tikInteractUser || !supabase) return;
    const { error } = await supabase.rpc('record_my_live_gift', {
        p_event_id: event.eventId,
        p_coins: event.coins
    });
    if (error) {
        console.error('Failed to record LIVE gift in leaderboard:', error);
        setLeaderboardStatus(`Un cadou nu s-a putut înregistra: ${error.message}`, true);
        return;
    }
    if (!document.getElementById('view-leaderboard')?.classList.contains('hidden')) {
        clearTimeout(leaderboardRefreshTimer);
        leaderboardRefreshTimer = setTimeout(loadLeaderboard, 1200);
    }
}

function setStreamerProfile(username, avatarUrl, displayName = username) {
    const profile = document.getElementById('tiktok-profile');
    const profileName = document.getElementById('tiktok-profile-name');
    const profileImage = document.getElementById('tiktok-profile-image');
    const profileFallback = document.getElementById('tiktok-profile-fallback');
    if (!profile || !username) return;

    profile.classList.remove('hidden');
    if (profileName) profileName.textContent = displayName === username ? `@${username}` : `${displayName} · @${username}`;
    if (profileFallback) {
        profileFallback.textContent = username.charAt(0).toUpperCase() || 'T';
        profileFallback.classList.remove('hidden');
    }

    let safeAvatarUrl = null;
    try {
        const parsedAvatarUrl = new URL(avatarUrl);
        if (parsedAvatarUrl.protocol === 'https:') safeAvatarUrl = parsedAvatarUrl.href;
    } catch {
        safeAvatarUrl = null;
    }

    setAccountAvatar(displayName || username, safeAvatarUrl);

    if (!profileImage) return;
    profileImage.onload = () => profileFallback?.classList.add('hidden');
    profileImage.onerror = () => {
        profileImage.classList.add('hidden');
        profileFallback?.classList.remove('hidden');
    };
    if (safeAvatarUrl) {
        profileImage.src = safeAvatarUrl;
        profileImage.classList.remove('hidden');
    } else {
        profileImage.removeAttribute('src');
        profileImage.classList.add('hidden');
    }
}

function setAccountAvatar(displayName, avatarUrl) {
    const avatar = document.getElementById('account-avatar-display');
    const image = document.getElementById('account-avatar-image');
    const headerAvatar = document.getElementById('header-account-avatar');
    const headerFallback = document.getElementById('header-account-avatar-fallback');
    const headerImage = document.getElementById('header-account-avatar-image');
    const initial = String(displayName || 'U').trim().charAt(0).toUpperCase() || 'U';

    if (avatar) {
        avatar.textContent = initial;
        avatar.classList.remove('hidden');
    }

    if (headerFallback) headerFallback.textContent = initial;
    if (image) {
        image.onload = () => {
            image.classList.remove('hidden');
            avatar?.classList.add('hidden');
        };
        image.onerror = () => {
            image.classList.add('hidden');
            avatar?.classList.remove('hidden');
        };
    }
    if (headerImage) {
        headerImage.onload = () => {
            headerImage.classList.remove('hidden');
            headerAvatar?.classList.remove('hidden');
            headerFallback?.classList.add('hidden');
        };
        headerImage.onerror = () => {
            headerImage.classList.add('hidden');
            headerFallback?.classList.remove('hidden');
        };
    }
    if (avatarUrl) {
        if (image) image.src = avatarUrl;
        if (headerImage) headerImage.src = avatarUrl;
    } else {
        if (image) {
            image.removeAttribute('src');
            image.classList.add('hidden');
        }
        if (headerImage) {
            headerImage.removeAttribute('src');
            headerImage.classList.add('hidden');
        }
        headerAvatar?.classList.add('hidden');
        headerFallback?.classList.remove('hidden');
    }
}

function clearStreamerProfile() {
    const profile = document.getElementById('tiktok-profile');
    const profileImage = document.getElementById('tiktok-profile-image');
    if (profile) profile.classList.add('hidden');
    if (profileImage) profileImage.removeAttribute('src');
    setAccountAvatar(document.getElementById('account-display-name')?.textContent, null);
}

function updateConnectionStatus(connected, username, connecting = false, avatarUrl = null) {
    const status = document.getElementById('tiktok-sync-status');
    const button = document.getElementById('btn-connect');
    const badge = document.getElementById('live-overview-status');

    connectedUsername = connected ? username : null;
    if (status) {
        status.textContent = connected
            ? `Stare: conectat la @${username}`
            : connecting
                ? `Stare: conectare la @${username}...`
                : 'Stare: neconectat';
        status.className = `mb-4 text-[10px] font-bold uppercase tracking-[0.14em] ${
            connected ? 'text-green-400' : connecting ? 'text-amber-400' : 'text-zinc-500'
        }`;
    }

    if (button) {
        button.textContent = connected || connecting ? 'Oprește Conexiunea' : 'Pornește Conexiunea Live';
        button.className = connected || connecting
            ? 'w-full bg-zinc-800 hover:bg-zinc-700 text-white font-bold py-3 rounded-xl text-xs transition cursor-pointer'
            : 'w-full bg-red-600 hover:bg-red-500 text-white font-bold py-3 rounded-xl text-xs glow-red transition cursor-pointer';
    }

    if (badge) {
        badge.textContent = connected ? 'Conectat' : connecting ? 'Se conectează' : 'Offline';
        badge.classList.toggle('is-connected', connected);
    }

    if (connected && username) {
        setStreamerProfile(username, avatarUrl);
    }
}

function showConnectionError(message) {
    updateConnectionStatus(false, null);
    window.alert(`Eroare TikTok LIVE: ${message}`);
}

function connectToLocalServer() {
    if (socket && (socket.readyState === WebSocket.OPEN || socket.readyState === WebSocket.CONNECTING)) return;

    socket = new WebSocket('ws://127.0.0.1:3000/ws');
    socket.addEventListener('open', () => {
        socket.send(JSON.stringify({ type: 'state' }));
    });
    socket.addEventListener('message', (event) => {
        let message;
        try {
            message = JSON.parse(event.data);
        } catch {
            console.error('Invalid message received from TikInteract server.');
            return;
        }

        if (message.type === 'status') {
            updateConnectionStatus(message.connected, message.username, message.connecting, message.avatarUrl);
            if (message.connected && message.username) {
                startPlatformLiveSession(message.username);
            } else {
                finishPlatformLiveSession().catch((error) => {
                    console.error('Failed to finish LIVE session:', error);
                });
            }
        } else if (message.type === 'profile') {
            setStreamerProfile(message.username, message.avatarUrl, message.displayName);
            saveTikTokLeaderboardProfile(message.username, message.displayName, message.avatarUrl)
                .then(() => loadLeaderboard())
                .catch((error) => {
                    console.error('Failed to save TikTok profile:', error);
                    const status = document.getElementById('tiktok-sync-status');
                    if (status) {
                        status.textContent = `Poza a fost găsită, dar profilul nu s-a salvat: ${error.message}`;
                        status.className = 'mb-4 text-[10px] font-bold uppercase tracking-[0.14em] text-amber-400';
                    }
                });
            const status = document.getElementById('tiktok-sync-status');
            if (status && !connectedUsername && !window.tikInteractUser) {
                status.textContent = message.avatarUrl
                    ? `Profil TikTok găsit: @${message.username}`
                    : `Profil găsit, poza nu este disponibilă: @${message.username}`;
                status.className = `mb-4 text-[10px] font-bold uppercase tracking-[0.14em] ${
                    message.avatarUrl ? 'text-green-400' : 'text-zinc-400'
                }`;
            }
        } else if (message.type === 'profile-error') {
            const status = document.getElementById('tiktok-sync-status');
            if (status && !connectedUsername) {
                status.textContent = `Nu am putut încărca profilul: ${message.message}`;
                status.className = 'mb-4 text-[10px] font-bold uppercase tracking-[0.14em] text-amber-400';
            }
            console.warn('TikTok profile lookup failed:', message.message);
        } else if (message.type === 'connecting') {
            updateConnectionStatus(false, message.username, true);
        } else if (message.type === 'error') {
            showConnectionError(message.message);
        } else if (message.type === 'chat' || message.type === 'gift') {
            handleTikTokEvent(message);
        }
    });
    socket.addEventListener('close', () => {
        updateConnectionStatus(false, null);
        finishPlatformLiveSession().catch((error) => {
            console.error('Failed to finish LIVE session:', error);
        });
        socket = null;
    });
    socket.addEventListener('error', () => {
        updateConnectionStatus(false, null);
    });
}

function disconnectTikTokConnection() {
    if (socket?.readyState === WebSocket.OPEN) {
        socket.send(JSON.stringify({ type: 'disconnect' }));
    }
    updateConnectionStatus(false, null);
    finishPlatformLiveSession().catch((error) => {
        console.error('Failed to finish LIVE session:', error);
    });
}

function toggleTikTokConnection() {
    const input = document.getElementById('tiktok-user');
    const button = document.getElementById('btn-connect');
    if (!input || !button) return;

    if (connectedUsername || button.textContent.includes('Oprește')) {
        disconnectTikTokConnection();
        return;
    }

    const username = input.value.trim().replace(/^@/, '');
    if (!/^[A-Za-z0-9._]{2,24}$/.test(username)) {
        window.alert('Introdu un username TikTok valid (2-24 caractere).');
        return;
    }

    try {
        localStorage.setItem('tikinteract_tiktok_user', `@${username}`);
    } catch (error) {
        console.warn('Local storage unavailable:', error);
    }

    connectToLocalServer();
    if (socket?.readyState === WebSocket.OPEN) {
        socket.send(JSON.stringify({ type: 'connect', username }));
    } else if (socket?.readyState === WebSocket.CONNECTING) {
        const pendingSocket = socket;
        pendingSocket.addEventListener('open', () => {
            pendingSocket.send(JSON.stringify({ type: 'connect', username }));
        }, { once: true });
        pendingSocket.addEventListener('close', (event) => {
            if (event.code === 1008) {
                showConnectionError('Originea paginii nu este permisă de serverul local. Folosește https://tikinteract.vercel.app/.');
                return;
            }
            showConnectionError('Nu pot ajunge la serverul local. Pornește start-tikinteract.bat pe acest calculator și încearcă din nou.');
        }, { once: true });
    } else {
        showConnectionError('Nu pot ajunge la serverul local. Pornește start-tikinteract.bat pe acest calculator și încearcă din nou.');
    }
}

function lookupTikTokProfile(rawUsername) {
    const username = String(rawUsername || '').trim().replace(/^@/, '');
    if (!/^[A-Za-z0-9._]{2,24}$/.test(username)) {
        window.alert('Introdu un username TikTok valid.');
        return;
    }

    setStreamerProfile(username, null);
    const status = document.getElementById('tiktok-sync-status');
    if (status) {
        status.textContent = `Se caută profilul @${username}...`;
        status.className = 'mb-4 text-[10px] font-bold uppercase tracking-[0.14em] text-amber-400';
    }

    connectToLocalServer();
    const requestProfile = () => {
        if (socket?.readyState === WebSocket.OPEN) {
            socket.send(JSON.stringify({ type: 'profile', username }));
        }
    };

    if (socket?.readyState === WebSocket.OPEN) {
        requestProfile();
    } else if (socket?.readyState === WebSocket.CONNECTING) {
        const pendingSocket = socket;
        pendingSocket.addEventListener('open', requestProfile, { once: true });
        pendingSocket.addEventListener('close', () => {
            const profileStatus = document.getElementById('tiktok-sync-status');
            if (profileStatus) profileStatus.textContent = 'Pornește serverul local și încearcă din nou.';
        }, { once: true });
    } else {
        if (status) status.textContent = 'Pornește serverul local și încearcă din nou.';
    }
}

function handleTikTokEvent(event) {
    const username = String(event.username || 'utilizator').replace(/^@/, '');
    const isGift = event.type === 'gift';
    const text = isGift ? `a trimis ${event.giftName}` : event.message;
    if (!text) return;

    totalScore += isGift ? 10 : 1;
    if (isGift) giftCount += 1;
    if (isGift) recordLeaderboardGift(event).catch((error) => {
        console.error('Failed to save gift statistics:', error);
    });

    const score = document.getElementById('score-display');
    const gifts = document.getElementById('gift-count');
    const eventCount = document.getElementById('event-count');
    if (score) score.textContent = String(totalScore);
    if (gifts) gifts.textContent = String(giftCount);
    if (eventCount) eventCount.textContent = String(Number(eventCount.textContent) + 1);

    const feed = document.getElementById('feed-list');
    if (feed) {
        const row = document.createElement('div');
        row.className = 'feed-item flex items-center gap-3';
        const avatar = document.createElement('div');
        avatar.className = 'feed-avatar';
        const sender = document.createElement('strong');
        sender.className = 'min-w-0';
        sender.textContent = `@${username}`;
        const fallback = document.createElement('span');
        fallback.className = 'feed-avatar-fallback';
        fallback.textContent = username.charAt(0).toUpperCase() || 'T';
        avatar.append(fallback);

        let safeAvatarUrl = null;
        try {
            const parsedAvatarUrl = new URL(event.avatarUrl);
            if (parsedAvatarUrl.protocol === 'https:') safeAvatarUrl = parsedAvatarUrl.href;
        } catch {
            safeAvatarUrl = null;
        }

        if (safeAvatarUrl) {
            const image = document.createElement('img');
            image.className = 'feed-avatar-image';
            image.alt = `Poza de profil a lui @${username}`;
            image.loading = 'lazy';
            image.src = safeAvatarUrl;
            image.addEventListener('load', () => fallback.classList.add('hidden'), { once: true });
            image.addEventListener('error', () => image.remove(), { once: true });
            avatar.append(image);
        }

        const content = document.createElement('span');
        content.className = 'min-w-0';
        content.append(sender, document.createTextNode(` ${text}`));
        row.append(avatar, content);
        feed.prepend(row);
        while (feed.children.length > 30) feed.lastElementChild.remove();
    }

    addGameEffect(isGift ? '#ef4444' : '#f43f5e', isGift ? 8 : 1);
}

function addGameEffect(color, points) {
    const canvas = document.getElementById('hubCanvas');
    if (!canvas) return;

    for (let i = 0; i < points; i++) {
        items.push({
            x: Math.random() * canvas.width,
            y: canvas.height + 10,
            size: Math.random() * 8 + 4,
            speed: Math.random() * -3 - 1,
            color
        });
    }
}

function runEngine() {
    const canvas = document.getElementById('hubCanvas');
    const ctx = canvas?.getContext('2d');
    if (!canvas || !ctx) return;

    function loop() {
        ctx.fillStyle = '#050507';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.fillStyle = '#8f8085';
        ctx.font = '12px monospace';
        ctx.fillText(connectedUsername ? `LIVE // @${connectedUsername}` : 'Așteaptă conexiunea TikTok LIVE', 16, 24);

        for (let idx = items.length - 1; idx >= 0; idx--) {
            const item = items[idx];
            item.y += item.speed;
            ctx.fillStyle = item.color;
            ctx.beginPath();
            ctx.arc(item.x, item.y, item.size, 0, Math.PI * 2);
            ctx.fill();
            if (item.y < -20) items.splice(idx, 1);
        }
        requestAnimationFrame(loop);
    }
    loop();
}

document.addEventListener('DOMContentLoaded', () => {
    connectToLocalServer();
    runEngine();
    loadSoundEffectLibrary().catch((error) => {
        console.error('Could not load the local sound library:', error);
        renderSoundEffectCards();
        setSoundLibraryStatus(`Biblioteca audio indisponibilă: ${error.message}`, true);
    });
});

window.refreshTikInteractConnectionState = () => {
    if (socket?.readyState === WebSocket.OPEN) {
        socket.send(JSON.stringify({ type: 'state' }));
    }
};