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
    ['Applause', 'sfx', 'applause-88e87f19.mp3'],
    ['Celebration', 'sfx', 'celebrate-81c37c6c.mp3'],
    ['Audience laugh', 'sfx', 'laugh-493bdc04.mp3'],
    ['Epic fail', 'sfx', 'fail-1467bd20.mp3'],
    ['Big impact', 'sfx', 'impact-cinematic-fad977e1.mp3'],
    ['Whoosh', 'sfx', 'transition-d1dfe1da.mp3'],
    ['Suspense', 'sfx', 'suspense-081843c6.mp3'],
    ['Coin drop', 'sfx', 'coin-8b35e392.mp3'],
    ['Level up', 'sfx', 'level-up-c8cc1011.mp3'],
    ['Laser', 'sfx', 'laser-c3cd1647.mp3'],
    ['Power boost', 'sfx', 'power-up-5e234952.mp3'],
    ['Glitch', 'sfx', 'glitch-6bd6ca4e.mp3'],
    ['Ping', 'sfx', 'ping-23a199fb.mp3'],
    ['Pop drop', 'sfx', 'drop-67cc49cf.mp3'],
    ['Victory', 'sfx', 'win-98c847e8.mp3'],
    ['Impact', 'sfx', 'impact-c59fb509.mp3'],
    ['Switch', 'sfx', 'switch-07f96f0c.mp3'],
    ['Spark', 'sfx', 'spark-e7b2675f.mp3'],
    ['Alert', 'sfx', 'alert-5284263c.mp3'],
    ['Arcade intro', 'music', 'music-arcade-intro-dfcd5a08.mp3'],
    ['Arcade victory', 'music', 'music-arcade-victory-5918460b.mp3'],
    ['Pizzicato interlude', 'music', 'music-pizzicato-interlude-54f0b00e.mp3'],
    ['Cipher', 'music', 'music-cipher-b855e08d.mp3'],
    ['E lutador', 'meme', 'meme-e-lutador-4e03396f625a.mp3'],
    ['Ack', 'meme', 'meme-ack-6247b97b6e16.mp3'],
    ['Am trei rânduri de creier', 'meme', 'meme-am-trei-randuri-de-creier-2272fc05456b.mp3'],
    ['Anime Ahh', 'meme', 'meme-anime-ahh-059c7e7e8812.mp3'],
    ['Apple Pay', 'meme', 'meme-apple-pay-155c50f8dafc.mp3'],
    ['Baby laughing', 'meme', 'meme-baby-laughing-1a8862951f78.mp3'],
    ['Cat laugh', 'meme', 'meme-cat-laugh-ddb7d4b51418.mp3'],
    ['Core', 'meme', 'meme-core-0ead4ef1b101.mp3'],
    ['Dry fart', 'meme', 'meme-dry-fart-11c2bbd0505f.mp3'],
    ['Dun dun dun', 'meme', 'meme-dun-dun-dun-6cc67ae7ef0b.mp3'],
    ['Emotional damage', 'meme', 'meme-emotional-damage-e1668d57edc6.mp3'],
    ['Error', 'meme', 'meme-error-e5c633eda237.mp3'],
    ['Fah!', 'meme', 'meme-fah-f65311d5eea2.mp3'],
    ['Indian song', 'meme', 'meme-indian-song-da296d29a235.mp3'],
    ['Levántense', 'meme', 'meme-levantense-bafb3fdb9691.mp3'],
    ['Made in Romania', 'meme', 'meme-made-in-romania-c01ce37661b3.mp3'],
    ['Meow', 'meme', 'meme-meow-41edbeb32801.mp3'],
    ['Me perdonas', 'meme', 'meme-me-perdonas-1ef16185f329.mp3'],
    ['Movie', 'meme', 'meme-movie-6a04c34422d1.mp3'],
    ['NY audio', 'meme', 'meme-ny-audio-70aa1b6af030.mp3'],
    ['Oh my God bro', 'meme', 'meme-oh-my-god-bro-cb6b3179d996.mp3'],
    ['Perfect fart', 'meme', 'meme-perfect-fart-2c94897d0856.mp3'],
    ['Piuw', 'meme', 'meme-piuw-cee2d5c15dee.mp3'],
    ['Pou', 'meme', 'meme-pou-882f3f81f3ea.mp3'],
    ['Pump shotgun', 'meme', 'meme-pump-shotgun-a51791b5c1cc.mp3'],
    ['Rizz', 'meme', 'meme-rizz-dbbde7a7920b.mp3'],
    ['Șarpili', 'meme', 'meme-sarpili-cbf6aa4fb2d6.mp3'],
    ['Spiderman', 'meme', 'meme-spiderman-a029a61b6563.mp3'],
    ['SpongeBob fail', 'meme', 'meme-spongebob-fail-7a21ade91762.mp3'],
    ['Sukuna gugu gaga', 'meme', 'meme-sukuna-gugu-gaga-83210eab3713.mp3'],
    ['TF Nemesis', 'meme', 'meme-tf-nemesis-6aa0f62297c2.mp3'],
    ['Tuco Get Out', 'meme', 'meme-tuco-get-out-6142bc0b94a0.mp3'],
    ['Vine boom', 'meme', 'meme-vine-boom-c4dadbc0b9cd.mp3']
].map(([name, category, file], index) => ({
    id: `sound-${String(index + 1).padStart(2, '0')}`,
    name,
    category,
    src: `sounds/${file}`
}));

const soundEffectVisuals = {
    Applause: ['fa-hands-clapping', '#fb7185'],
    Celebration: ['fa-champagne-glasses', '#fbbf24'],
    'Audience laugh': ['fa-face-laugh', '#a3e635'],
    'Epic fail': ['fa-face-dizzy', '#f87171'],
    'Big impact': ['fa-bomb', '#fb923c'],
    Whoosh: ['fa-wind', '#38bdf8'],
    Suspense: ['fa-eye', '#a78bfa'],
    'Coin drop': ['fa-coins', '#facc15'],
    'Level up': ['fa-arrow-trend-up', '#4ade80'],
    Laser: ['fa-bullseye', '#f43f5e'],
    'Power boost': ['fa-bolt', '#facc15'],
    Glitch: ['fa-bug', '#c084fc'],
    Ping: ['fa-bell', '#60a5fa'],
    'Pop drop': ['fa-droplet', '#22d3ee'],
    Victory: ['fa-trophy', '#fbbf24'],
    Impact: ['fa-bolt', '#f97316'],
    Switch: ['fa-toggle-on', '#2dd4bf'],
    Spark: ['fa-star', '#fde047'],
    Alert: ['fa-triangle-exclamation', '#fb7185'],
    'Arcade intro': ['fa-gamepad', '#c084fc'],
    'Arcade victory': ['fa-trophy', '#fbbf24'],
    'Pizzicato interlude': ['fa-music', '#f472b6'],
    Cipher: ['fa-user-secret', '#818cf8'],
    'E lutador': ['fa-hand-fist', '#fb923c'],
    Ack: ['fa-comment-dots', '#60a5fa'],
    'Am trei rânduri de creier': ['fa-brain', '#c084fc'],
    'Anime Ahh': ['fa-face-surprise', '#f472b6'],
    'Apple Pay': ['fa-wallet', '#a3e635'],
    'Baby laughing': ['fa-face-laugh', '#fbbf24'],
    'Cat laugh': ['fa-cat', '#fb923c'],
    Core: ['fa-cubes', '#22d3ee'],
    'Dry fart': ['fa-wind', '#a1a1aa'],
    'Dun dun dun': ['fa-drum', '#fb7185'],
    'Emotional damage': ['fa-heart-crack', '#f87171'],
    Error: ['fa-circle-exclamation', '#f87171'],
    'Fah!': ['fa-face-angry', '#f97316'],
    'Indian song': ['fa-music', '#f472b6'],
    'Levántense': ['fa-arrow-up', '#4ade80'],
    'Made in Romania': ['fa-flag', '#facc15'],
    Meow: ['fa-cat', '#c084fc'],
    'Me perdonas': ['fa-hands-praying', '#60a5fa'],
    Movie: ['fa-film', '#a78bfa'],
    'NY audio': ['fa-city', '#38bdf8'],
    'Oh my God bro': ['fa-face-surprise', '#fbbf24'],
    'Perfect fart': ['fa-wind', '#a1a1aa'],
    Piuw: ['fa-rocket', '#22d3ee'],
    Pou: ['fa-ghost', '#a78bfa'],
    'Pump shotgun': ['fa-crosshairs', '#f97316'],
    Rizz: ['fa-heart', '#f472b6'],
    Șarpili: ['fa-dragon', '#4ade80'],
    Spiderman: ['fa-spider', '#f87171'],
    'SpongeBob fail': ['fa-face-dizzy', '#facc15'],
    'Sukuna gugu gaga': ['fa-skull', '#c084fc'],
    'TF Nemesis': ['fa-robot', '#60a5fa'],
    'Tuco Get Out': ['fa-arrow-right', '#fb923c'],
    'Vine boom': ['fa-bomb', '#f43f5e']
};

let loadedSoundEffects = new Map();
let activeSoundEffectId = null;
let soundMasterVolume = 0.75;
const SOUND_FAVORITES_KEY = 'tikinteract-audio-favorites';
const MAX_AUDIO_FAVORITES = 12;
let favoriteSoundIds = new Set();
let audioLibraryTab = 'sounds';
let audioLibraryScope = 'all';
let audioFavoriteToastTimer = null;
let audioFavoriteToastHideTimer = null;

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

function setSoundLibraryStatus(message, isError = false) {
    const status = document.getElementById('audio-center-status');
    if (!status) return;
    status.textContent = message;
    status.classList.toggle('is-error', isError);
}

function showAudioFavoriteToast(message, type = 'success') {
    const toast = document.getElementById('audio-favorite-toast');
    const toastMessage = document.getElementById('audio-favorite-toast-message');
    if (!toast || !toastMessage) return;

    window.clearTimeout(audioFavoriteToastTimer);
    window.clearTimeout(audioFavoriteToastHideTimer);
    toastMessage.textContent = message;
    toast.classList.toggle('is-warning', type === 'warning');
    toast.classList.toggle('is-error', type === 'error');
    toast.querySelector('.audio-favorite-toast-icon i').className = type === 'warning'
        ? 'fa-solid fa-triangle-exclamation'
        : type === 'error'
            ? 'fa-solid fa-circle-exclamation'
            : 'fa-solid fa-star';
    toast.setAttribute('role', type === 'warning' || type === 'error' ? 'alert' : 'status');
    toast.setAttribute('aria-live', type === 'warning' || type === 'error' ? 'assertive' : 'polite');
    toast.classList.remove('hidden');
    toast.classList.remove('is-visible');
    toast.getBoundingClientRect();
    toast.classList.add('is-visible');
    audioFavoriteToastTimer = window.setTimeout(() => {
        toast.classList.remove('is-visible');
        audioFavoriteToastHideTimer = window.setTimeout(() => toast.classList.add('hidden'), 220);
    }, 3600);
}

function loadFavoriteSoundIds() {
    try {
        const savedFavorites = JSON.parse(localStorage.getItem(SOUND_FAVORITES_KEY) || '[]');
        const validFavorites = Array.isArray(savedFavorites)
            ? [...new Set(savedFavorites.filter((soundId) => soundEffectCatalog.some((sound) => sound.id === soundId)))]
            : [];
        const exceededLimit = validFavorites.length > MAX_AUDIO_FAVORITES;
        favoriteSoundIds = new Set(validFavorites.slice(0, MAX_AUDIO_FAVORITES));
        if (exceededLimit) {
            localStorage.setItem(SOUND_FAVORITES_KEY, JSON.stringify([...favoriteSoundIds]));
            setSoundLibraryStatus(`Am păstrat primele ${MAX_AUDIO_FAVORITES} favorite. Limita este de ${MAX_AUDIO_FAVORITES} sunete.`, true);
        }
        return exceededLimit;
    } catch (error) {
        console.error('Could not load audio favorites:', error);
        favoriteSoundIds = new Set();
        setSoundLibraryStatus('Favoritele nu au putut fi citite din stocarea browserului.', true);
        return false;
    }
}

function updateSoundFavoriteButton(soundId) {
    const button = document.querySelector(`[data-sound-favorite="${soundId}"]`);
    if (!button) return;
    const isFavorite = favoriteSoundIds.has(soundId);
    const sound = soundEffectCatalog.find((entry) => entry.id === soundId);
    button.classList.toggle('is-favorite', isFavorite);
    button.setAttribute('aria-pressed', String(isFavorite));
    button.setAttribute('aria-label', `${isFavorite ? 'Elimină' : 'Adaugă'} ${sound?.name || 'sunet'} ${isFavorite ? 'din' : 'la'} favorite`);
    button.innerHTML = `<i class="fa-${isFavorite ? 'solid' : 'regular'} fa-star" aria-hidden="true"></i>`;
}

function updateLiveFavoritePlayButton(soundId, isPlaying) {
    const button = document.querySelector(`[data-live-favorite-play="${soundId}"]`);
    if (!button) return;
    const sound = soundEffectCatalog.find((entry) => entry.id === soundId);
    button.classList.toggle('is-playing', isPlaying);
    button.setAttribute('aria-label', `${isPlaying ? 'Oprește' : 'Redă'} ${sound?.name || 'sunet'}`);
}

function searchLiveFavoriteSounds(query) {
    const results = document.getElementById('live-favorites-search-results');
    if (!results) return;

    results.replaceChildren();
    const normalizedQuery = query.trim().toLocaleLowerCase();
    const emptyState = document.getElementById('live-favorites-empty');
    if (emptyState) emptyState.classList.toggle('hidden', favoriteSoundIds.size > 0 || Boolean(normalizedQuery));
    if (!normalizedQuery) {
        results.classList.add('hidden');
        return;
    }

    const allMatches = soundEffectCatalog.filter((sound) => sound.name.toLocaleLowerCase().includes(normalizedQuery));
    const matches = allMatches.slice(0, 8);
    results.classList.remove('hidden');

    if (matches.length === 0) {
        const emptyResult = document.createElement('p');
        emptyResult.className = 'live-favorites-search-empty';
        emptyResult.textContent = 'Nu am găsit niciun sunet.';
        results.append(emptyResult);
        return;
    }

    matches.forEach((sound) => {
        const row = document.createElement('div');
        row.className = 'live-favorites-search-result';
        row.setAttribute('role', 'listitem');
        const [iconName, accentColor] = soundEffectVisuals[sound.name] || ['fa-wave-square', '#fb7185'];
        row.style.setProperty('--sound-accent', accentColor);

        const icon = document.createElement('i');
        icon.className = `fa-solid ${iconName}`;
        icon.setAttribute('aria-hidden', 'true');
        const name = document.createElement('span');
        name.className = 'live-favorites-search-name';
        name.textContent = sound.name;
        const addButton = document.createElement('button');
        const isFavorite = favoriteSoundIds.has(sound.id);
        addButton.type = 'button';
        addButton.className = 'live-favorites-search-add';
        addButton.disabled = isFavorite;
        addButton.setAttribute('aria-label', isFavorite ? `${sound.name} este deja la favorite` : `Adaugă ${sound.name} la favorite`);
        addButton.innerHTML = isFavorite
            ? '<i class="fa-solid fa-check" aria-hidden="true"></i>'
            : '<i class="fa-solid fa-plus" aria-hidden="true"></i>';
        if (!isFavorite) addButton.addEventListener('click', () => toggleSoundFavorite(sound.id));
        row.append(icon, name, addButton);
        results.append(row);
    });

    if (allMatches.length > matches.length) {
        const hint = document.createElement('p');
        hint.className = 'live-favorites-search-hint';
        hint.textContent = 'Afișate primele 8 rezultate. Rafinează căutarea pentru mai multe.';
        results.append(hint);
    }
}

function renderLiveFavoriteSounds() {
    const tableBody = document.getElementById('live-favorite-sounds');
    const emptyState = document.getElementById('live-favorites-empty');
    const count = document.getElementById('live-favorites-count');
    if (!tableBody || !emptyState || !count) return;

    tableBody.replaceChildren();
    const favorites = soundEffectCatalog.filter((sound) => favoriteSoundIds.has(sound.id));
    count.textContent = String(favorites.length);
    const audioFavoritesCount = document.getElementById('audio-favorites-count');
    if (audioFavoritesCount) audioFavoritesCount.textContent = `${favorites.length}/${MAX_AUDIO_FAVORITES}`;
    const searchInput = document.getElementById('live-favorites-search-input');
    emptyState.classList.toggle('hidden', favorites.length > 0 || Boolean(searchInput?.value.trim()));
    if (searchInput) searchLiveFavoriteSounds(searchInput.value);

    favorites.forEach((sound, index) => {
        const card = document.createElement('article');
        card.className = 'live-favorite-card';
        card.dataset.soundId = sound.id;
        card.setAttribute('role', 'listitem');
        const [iconName, accentColor] = soundEffectVisuals[sound.name] || ['fa-wave-square', '#fb7185'];
        card.style.setProperty('--sound-accent', accentColor);

        const header = document.createElement('div');
        header.className = 'live-favorite-card-topline';
        const number = document.createElement('span');
        number.className = 'live-favorite-number';
        number.textContent = String(index + 1);
        const removeButton = document.createElement('button');
        removeButton.type = 'button';
        removeButton.className = 'live-favorite-remove';
        removeButton.setAttribute('aria-label', `Elimină ${sound.name} din favorite`);
        removeButton.innerHTML = '<i class="fa-solid fa-star" aria-hidden="true"></i>';
        removeButton.addEventListener('click', () => toggleSoundFavorite(sound.id));
        header.append(number, removeButton);

        const playButton = document.createElement('button');
        playButton.type = 'button';
        playButton.className = 'live-favorite-trigger';
        playButton.dataset.liveFavoritePlay = sound.id;
        playButton.addEventListener('click', () => playSoundEffect(sound.id));
        const icon = document.createElement('span');
        icon.className = 'live-favorite-icon';
        icon.innerHTML = `<i class="fa-solid ${iconName}" aria-hidden="true"></i>`;
        const name = document.createElement('span');
        name.textContent = sound.name;
        name.className = 'live-favorite-title';
        playButton.append(icon, name);
        card.append(header, playButton);
        tableBody.append(card);
        updateLiveFavoritePlayButton(sound.id, activeSoundEffectId === sound.id);
    });
}

function toggleSoundFavorite(soundId) {
    const sound = soundEffectCatalog.find((entry) => entry.id === soundId);
    if (!sound) return;

    if (!favoriteSoundIds.has(soundId) && favoriteSoundIds.size >= MAX_AUDIO_FAVORITES) {
        const message = `Ai ajuns la limita de ${MAX_AUDIO_FAVORITES} favorite. Elimină un sunet favorit înainte să adaugi altul.`;
        setSoundLibraryStatus(message, true);
        showAudioFavoriteToast(message, 'warning');
        return;
    }

    if (favoriteSoundIds.has(soundId)) favoriteSoundIds.delete(soundId);
    else favoriteSoundIds.add(soundId);

    let saved = false;
    try {
        localStorage.setItem(SOUND_FAVORITES_KEY, JSON.stringify([...favoriteSoundIds]));
        saved = true;
    } catch (error) {
        console.error('Could not save audio favorites:', error);
    }

    updateSoundFavoriteButton(soundId);
    renderLiveFavoriteSounds();
    if (!saved) {
        const message = 'Nu am putut salva favoritele în browser. Verifică setările de stocare.';
        setSoundLibraryStatus(message, true);
        showAudioFavoriteToast(message, 'error');
    } else {
        const message = favoriteSoundIds.has(soundId)
            ? `${sound.name} a fost adăugat la favorite.`
            : `${sound.name} a fost eliminat din favorite.`;
        setSoundLibraryStatus(message);
        showAudioFavoriteToast(message);
    }
    filterSoundEffects();
}

function renderSoundEffectCards() {
    const grid = document.getElementById('audio-sound-grid');
    if (!grid) return;
    grid.replaceChildren();

    soundEffectCatalog.forEach((sound, index) => {
        const card = document.createElement('article');
        card.className = 'audio-sound-card';
        card.dataset.soundId = sound.id;
        card.dataset.category = sound.category;
        const [iconName, accentColor] = soundEffectVisuals[sound.name] || ['fa-wave-square', '#fb7185'];
        card.style.setProperty('--sound-accent', accentColor);

        const cardHeader = document.createElement('div');
        cardHeader.className = 'audio-sound-card-topline';
        const number = document.createElement('span');
        number.className = 'audio-sound-number';
        number.textContent = String(index + 1);
        const icon = document.createElement('span');
        icon.className = 'audio-sound-icon';
        icon.innerHTML = `<i class="fa-solid ${iconName}" aria-hidden="true"></i>`;
        const name = document.createElement('h4');
        name.textContent = sound.name;

        const favoriteButton = document.createElement('button');
        favoriteButton.type = 'button';
        favoriteButton.className = 'audio-sound-favorite';
        favoriteButton.dataset.soundFavorite = sound.id;
        favoriteButton.addEventListener('click', () => toggleSoundFavorite(sound.id));

        const playButton = document.createElement('button');
        playButton.type = 'button';
        playButton.className = 'audio-sound-trigger';
        playButton.dataset.soundPlay = '';
        playButton.disabled = !sound.src;
        playButton.setAttribute('aria-label', `Redă ${sound.name}`);
        playButton.addEventListener('click', () => playSoundEffect(sound.id));
        playButton.append(icon, name);

        cardHeader.append(number, favoriteButton);
        card.append(cardHeader, playButton);
        grid.append(card);
        updateSoundFavoriteButton(sound.id);
    });

    filterSoundEffects();
}

function updateSoundEffectCard(soundId, isPlaying = false) {
    const card = document.querySelector(`[data-sound-id="${soundId}"]`);
    if (!card) return;
    const playButton = card.querySelector('[data-sound-play]');
    if (playButton) {
        playButton.disabled = !loadedSoundEffects.has(soundId);
        playButton.classList.toggle('is-playing', isPlaying);
        playButton.setAttribute('aria-label', `${isPlaying ? 'Oprește' : 'Redă'} ${card.querySelector('h4')?.textContent || 'sunet'}`);
    }
    updateLiveFavoritePlayButton(soundId, isPlaying);
}

function loadSoundEffectLibrary() {
    const favoritesWereTrimmed = loadFavoriteSoundIds();
    renderSoundEffectCards();
    stopAllSoundEffects();
    loadedSoundEffects = new Map();

    soundEffectCatalog.forEach((sound) => {
        const player = new Audio(sound.src);
        player.preload = 'none';
        player.volume = soundMasterVolume;
        player.addEventListener('ended', () => {
            if (activeSoundEffectId === sound.id) activeSoundEffectId = null;
            updateSoundEffectCard(sound.id, false);
        });
        player.addEventListener('error', () => {
            if (activeSoundEffectId === sound.id) activeSoundEffectId = null;
            updateSoundEffectCard(sound.id, false);
            setSoundLibraryStatus(`Sunetul integrat „${sound.name}” nu s-a putut încărca. Verifică fișierul ${sound.src}.`, true);
        });
        loadedSoundEffects.set(sound.id, { player, name: sound.name });
    });

    renderLiveFavoriteSounds();
    if (!favoritesWereTrimmed) {
        setSoundLibraryStatus(`${soundEffectCatalog.length} de sunete integrate. Alege un buton pentru redare.`);
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
        updateSoundEffectCard(soundId, false);
        return;
    }

    stopAllSoundEffects();
    sound.player.currentTime = 0;
    sound.player.volume = soundMasterVolume;
    try {
        await sound.player.play();
        activeSoundEffectId = soundId;
        updateSoundEffectCard(soundId, true);
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
        updateSoundEffectCard(soundId, false);
    });
    activeSoundEffectId = null;
}

function setAudioMasterVolume(value) {
    const parsedVolume = Number(value);
    if (!Number.isFinite(parsedVolume)) return;
    soundMasterVolume = Math.max(0, Math.min(1, parsedVolume / 100));
    loadedSoundEffects.forEach(({ player }) => { player.volume = soundMasterVolume; });
    const percentage = Math.round(soundMasterVolume * 100);
    ['audio-master-volume', 'audio-center-master-volume'].forEach((id) => {
        const slider = document.getElementById(id);
        if (slider) slider.value = String(percentage);
    });
    ['audio-master-volume-value', 'audio-center-volume-value'].forEach((id) => {
        const display = document.getElementById(id);
        if (display) display.textContent = `${percentage}%`;
    });
}

function filterSoundEffects() {
    const search = document.getElementById('audio-sound-search')?.value.trim().toLocaleLowerCase() || '';
    const category = document.getElementById('audio-sound-category')?.value || 'all';
    let visibleCount = 0;
    document.querySelectorAll('.audio-sound-card').forEach((card) => {
        const matches = card.querySelector('h4')?.textContent.toLocaleLowerCase().includes(search) || false;
        const categoryMatches = category === 'all' || card.dataset.category === category;
        const tabMatches = audioLibraryTab === 'music'
            ? card.dataset.category === 'music'
            : card.dataset.category !== 'music';
        const scopeMatches = audioLibraryScope === 'all' || favoriteSoundIds.has(card.dataset.soundId);
        const visible = matches && categoryMatches && tabMatches && scopeMatches;
        card.classList.toggle('hidden', !visible);
        if (visible) visibleCount += 1;
    });

    const count = document.getElementById('audio-library-count');
    if (count) count.textContent = `${visibleCount} sunete`;
}

function setAudioLibraryTab(tab) {
    audioLibraryTab = tab === 'music' ? 'music' : 'sounds';
    const categoryFilter = document.getElementById('audio-sound-category');
    if (categoryFilter) {
        categoryFilter.value = 'all';
        categoryFilter.querySelectorAll('option').forEach((option) => {
            if (option.value === 'all') return;
            option.hidden = audioLibraryTab === 'music'
                ? option.value !== 'music'
                : option.value === 'music';
        });
    }
    const soundsTab = document.getElementById('audio-sounds-tab');
    const musicTab = document.getElementById('audio-music-tab');
    [[soundsTab, audioLibraryTab === 'sounds'], [musicTab, audioLibraryTab === 'music']].forEach(([button, isActive]) => {
        if (!button) return;
        button.classList.toggle('is-active', isActive);
        button.setAttribute('aria-pressed', String(isActive));
    });
    filterSoundEffects();
}

function setAudioLibraryScope(scope) {
    audioLibraryScope = scope === 'favorites' ? 'favorites' : 'all';
    const allButton = document.getElementById('audio-filter-all');
    const favoritesButton = document.getElementById('audio-filter-favorites');
    [[allButton, audioLibraryScope === 'all'], [favoritesButton, audioLibraryScope === 'favorites']].forEach(([button, isActive]) => {
        if (!button) return;
        button.classList.toggle('is-active', isActive);
        button.setAttribute('aria-pressed', String(isActive));
    });
    filterSoundEffects();
}

function setLiveStudioTab(tab, options = {}) {
    const tabs = [...document.querySelectorAll('.live-studio-tabs [data-studio-tab]')];
    if (!tabs.some(button => button.dataset.studioTab === tab)) return;
    document.getElementById('view-live')?.classList.toggle('is-studio-mode', tab === 'studio');
    requestAnimationFrame(() => window.TikInteractStudioLayout?.fitGame());
    tabs.forEach(button => {
        const selected = button.dataset.studioTab === tab;
        document.getElementById(button.getAttribute('aria-controls'))?.classList.toggle('hidden', !selected);
        button.classList.toggle('is-active', selected);
        button.setAttribute('aria-selected', String(selected));
    });
    const backButton = document.getElementById('studio-back-button');
    if (backButton) backButton.hidden = tab === 'studio' || tab === 'audio';
    if (options.focus !== false && tab === 'audio') document.getElementById('audio-sound-search')?.focus();
    if (options.focus !== false && tab === 'games') document.getElementById('game-center-search')?.focus();
}

const studioTourSteps = [
    {tab:'studio', target:'.live-studio-tabs', title:'Bine ai venit în LIVE Studio', text:'Acestea sunt meniurile tale. Îți arătăm pe rând unde configurezi LIVE-ul, alegi jocurile și controlezi sunetele.'},
    {tab:'studio', target:'.studio-connection', title:'Conectează streamerul', text:'Introdu username-ul creatorului care este LIVE, salvează profilul și pornește conexiunea. Serverul local TikInteract trebuie să ruleze pe același calculator.'},
    {tab:'studio', target:'.studio-game-picker', title:'Jocurile tale, la un click', text:'Aici apar jocurile favorite. Apasă imaginea pentru a deschide jocul. Caută un joc și folosește steluța pentru a-l adăuga sau elimina din Acces rapid.'},
    {tab:'studio', target:'#studio-test-panel', title:'Testează jocul din Studio', text:'Comenzile TEST MENU sunt permanent vizibile în stânga. Testezi echipele, controlezi cursa și ajustezi vremea sau sunetele direct de aici.'},
    {tab:'studio', target:'.studio-stats', title:'Urmărește sesiunea', text:'Scor, Gifts și Evenimente arată activitatea primită în sesiunea curentă. Datele se actualizează când conexiunea primește evenimente LIVE.'},
    {tab:'studio', target:'.studio-stage .feed-box', title:'Evenimentele din LIVE', text:'Comentariile, like-urile și cadourile primite prin aceeași conexiune ajung automat la jocul deschis. Spectatorii aleg echipa prin chat: RED sau BLUE; Country Derby acceptă și GREEN.'},
    {tab:'games', target:'.game-center-heading', title:'Game Center', text:'Aceasta este biblioteca de jocuri. Caută după nume, apoi apasă „Deschide în Studio” pentru a încărca jocul ales.'},
    {tab:'games', target:'.game-center-card > .game-favorite-star', title:'Steluța adaugă la favorite', text:'Apasă ☆ pentru a adăuga jocul în Acces rapid. Apasă din nou pe ★ pentru a-l elimina. Favoritele se păstrează în browser.'},
    {tab:'audio', target:'.soundboard-library-controls', title:'Audio Center', text:'Aici găsești biblioteca de sunete. Alege toate sunetele sau doar favoritele. Mai jos poți căuta după nume și filtra după categorie.'},
    {tab:'audio', target:'.soundboard-monitor', title:'Control audio la îndemână', text:'Reglează volumul, oprește toate sunetele sau apasă ÎNAPOI pentru a reveni în LIVE Studio. Această bară te urmărește când derulezi.'},
    {tab:'studio', target:'.studio-audio', title:'Sunete rapide în timpul LIVE-ului', text:'Apasă un card pentru a reda un sunet favorit. Caută și adaugă sunete direct aici sau deschide Audio Center. Include audio-ul browserului în aplicația de streaming pentru ca publicul să le audă.'}
];
let studioTourIndex = -1;
let studioTourTarget = null;
let studioTourOrigin = null;

function openStudioHelp() {
    const dialog = document.getElementById('studio-help-dialog');
    if (!dialog || dialog.open) return;
    studioTourOrigin = {tab: document.querySelector('[data-studio-tab].is-active')?.dataset.studioTab || 'studio', scroll: window.scrollY, gameSearch: document.getElementById('game-center-search')?.value || ''};
    dialog.showModal();
    showStudioTourStep(0);
}

function closeStudioHelp() {
    document.getElementById('studio-help-dialog')?.close();
}

function showStudioTourStep(index) {
    if (index >= studioTourSteps.length) { closeStudioHelp(); return; }
    if (index < 0) return;
    studioTourIndex = index;
    const step = studioTourSteps[index];
    setLiveStudioTab(step.tab, {focus:false});
    studioTourTarget = document.querySelector(step.target);
    // A filtered library may hide the favorite control; restore visible cards for this step.
    if (step.tab === 'games' && studioTourTarget?.getClientRects().length === 0) {
        const input = document.getElementById('game-center-search');
        if (input) input.value = '';
        filterStudioGames('');
    }
    document.getElementById('studio-tour-title').textContent = step.title;
    document.getElementById('studio-tour-description').textContent = step.text;
    document.getElementById('studio-tour-progress').textContent = `${index + 1} / ${studioTourSteps.length}`;
    document.getElementById('studio-tour-prev').disabled = index === 0;
    document.getElementById('studio-tour-next').textContent = index === studioTourSteps.length - 1 ? 'Am înțeles' : 'Următorul →';
    studioTourTarget?.scrollIntoView({behavior:'instant', block:'center', inline:'nearest'});
    positionStudioTour();
    document.getElementById('studio-tour-next').focus({preventScroll:true});
}

function positionStudioTour() {
    if (studioTourIndex < 0 || !studioTourTarget) return;
    const dialog = document.getElementById('studio-help-dialog');
    if (!dialog?.open) return;
    const width = window.innerWidth, height = window.innerHeight;
    const box = studioTourTarget.getBoundingClientRect();
    const left = Math.max(6, Math.min(width - 6, box.left - 6));
    const top = Math.max(6, Math.min(height - 6, box.top - 6));
    const right = Math.max(left, Math.min(width - 6, box.right + 6));
    const bottom = Math.max(top, Math.min(height - 6, box.bottom + 6));
    const setRect = (id, x, y, w, h) => Object.assign(document.getElementById(id).style, {left:`${x}px`, top:`${y}px`, width:`${Math.max(0,w)}px`, height:`${Math.max(0,h)}px`});
    setRect('studio-tour-shade-top',0,0,width,top);
    setRect('studio-tour-shade-left',0,top,left,bottom-top);
    setRect('studio-tour-shade-right',right,top,width-right,bottom-top);
    setRect('studio-tour-shade-bottom',0,bottom,width,height-bottom);
    setRect('studio-tour-highlight',left,top,right-left,bottom-top);
    const tip = document.getElementById('studio-tour-tooltip');
    const tipWidth = tip.offsetWidth, tipHeight = tip.offsetHeight, gap = 16;
    let x, y;
    if (width - right >= tipWidth + gap + 12) { x = right + gap; y = top; }
    else if (left >= tipWidth + gap + 12) { x = left - tipWidth - gap; y = top; }
    else { x = left + (right-left-tipWidth)/2; y = height-bottom >= tipHeight+gap ? bottom+gap : top-tipHeight-gap; }
    tip.style.left = `${Math.max(12, Math.min(width-tipWidth-12, x))}px`;
    tip.style.top = `${Math.max(12, Math.min(height-tipHeight-12, y))}px`;
}

function finishStudioTour() {
    studioTourIndex = -1;
    studioTourTarget = null;
    if (studioTourOrigin) {
        const search = document.getElementById('game-center-search');
        if (search) search.value = studioTourOrigin.gameSearch;
        filterStudioGames(studioTourOrigin.gameSearch);
        setLiveStudioTab(studioTourOrigin.tab, {focus:false});
        window.scrollTo({top:studioTourOrigin.scroll, behavior:'instant'});
        studioTourOrigin = null;
    }
    document.getElementById('studio-help-button')?.focus({preventScroll:true});
}

function returnToLiveStudio() {
    setLiveStudioTab('studio');
    document.getElementById('live-studio-tab')?.focus({preventScroll: true});
    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    document.getElementById('view-live')?.scrollIntoView({behavior: reducedMotion ? 'instant' : 'smooth', block: 'start'});
}

function filterStudioGames(query) {
    const normalized = query.trim().toLocaleLowerCase('ro');
    let visible = 0;
    document.querySelectorAll('[data-game-center-card]').forEach((card) => {
        const matches = card.dataset.gameCenterCard.toLocaleLowerCase('ro').includes(normalized);
        card.hidden = !matches;
        if (matches) visible++;
    });
    const empty = document.getElementById('game-center-empty');
    if (empty) empty.hidden = visible > 0;
}

function launchStudioGame(gameId) {
    loadLiveGame(gameId);
    setLiveStudioTab('studio');
    document.querySelector(`[data-live-game="${gameId}"]`)?.focus({preventScroll: true});
}

const GAME_FAVORITES_KEY = 'tikinteract_game_favorites_v1';
let favoriteGameIds = new Set();
let studioGameCatalog = [];

function initializeGameFavorites() {
    const select = document.getElementById('live-game-select');
    if (!select) return;
    const cards = [...document.querySelectorAll('[data-game-center-card]')];
    studioGameCatalog = [...select.options].map((option, index) => ({
        id: option.value, name: option.textContent.trim(),
        image: cards[index]?.querySelector('img')?.getAttribute('src') || '',
        card: cards[index]
    }));
    try {
        const saved = JSON.parse(localStorage.getItem(GAME_FAVORITES_KEY) || '[]');
        favoriteGameIds = new Set(Array.isArray(saved) ? saved.filter(id => studioGameCatalog.some(game => game.id === id)) : []);
    } catch { favoriteGameIds = new Set(); }
    studioGameCatalog.forEach(game => {
        if (!game.card || game.card.querySelector('[data-game-favorite]')) return;
        game.card.prepend(createGameFavoriteButton(game));
    });
    refreshGameFavorites();
}

function createGameFavoriteButton(game) {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'game-favorite-star';
    button.dataset.gameFavorite = game.id;
    button.addEventListener('click', (event) => {
        event.stopPropagation();
        toggleGameFavorite(game.id);
    });
    return button;
}

function toggleGameFavorite(gameId) {
    if (!studioGameCatalog.some(game => game.id === gameId)) return;
    if (favoriteGameIds.has(gameId)) favoriteGameIds.delete(gameId);
    else favoriteGameIds.add(gameId);
    try { localStorage.setItem(GAME_FAVORITES_KEY, JSON.stringify([...favoriteGameIds])); } catch { /* Keep favorites usable in memory when storage is unavailable. */ }
    refreshGameFavorites();
}

function refreshGameFavorites() {
    const count = document.getElementById('studio-game-favorites-count');
    if (count) count.textContent = favoriteGameIds.size;
    renderQuickGames();
    document.querySelectorAll('[data-game-favorite]').forEach(button => {
        const selected = favoriteGameIds.has(button.dataset.gameFavorite);
        const game = studioGameCatalog.find(item => item.id === button.dataset.gameFavorite);
        button.textContent = selected ? '★' : '☆';
        button.classList.toggle('is-favorite', selected);
        button.setAttribute('aria-pressed', String(selected));
        button.setAttribute('aria-label', `${selected ? 'Elimină din favorite' : 'Adaugă la favorite'}: ${game?.name || ''}`);
        button.title = selected ? 'Elimină din Acces rapid' : 'Adaugă în Acces rapid';
    });
}

function renderQuickGames() {
    const list = document.querySelector('.studio-game-options');
    if (!list) return;
    const query = (document.getElementById('studio-quick-search')?.value || '').trim().toLocaleLowerCase('ro');
    const games = studioGameCatalog.filter(game => query ? game.name.toLocaleLowerCase('ro').includes(query) : favoriteGameIds.has(game.id));
    const selectedId = document.getElementById('live-game-select')?.value;
    list.replaceChildren();
    games.forEach(game => {
        const item = document.createElement('div');
        item.className = 'studio-quick-item';
        const open = document.createElement('button');
        open.type = 'button';
        open.className = 'studio-game-option';
        open.dataset.liveGame = game.id;
        open.classList.toggle('is-active', selectedId === game.id);
        open.setAttribute('aria-pressed', String(selectedId === game.id));
        open.title = game.name;
        open.addEventListener('click', () => loadLiveGame(game.id));
        const image = document.createElement('img');
        image.src = game.image; image.alt = ''; image.width = 42; image.height = 38;
        const label = document.createElement('span'); label.textContent = game.name;
        open.append(image, label);
        const star = createGameFavoriteButton(game);
        const favorite = favoriteGameIds.has(game.id);
        star.textContent = favorite ? '★' : '☆';
        star.classList.toggle('is-favorite', favorite);
        star.setAttribute('aria-pressed', String(favorite));
        star.setAttribute('aria-label', `${favorite ? 'Elimină din favorite' : 'Adaugă la favorite'}: ${game.name}`);
        star.title = favorite ? 'Elimină din Acces rapid' : 'Adaugă în Acces rapid';
        item.append(open, star); list.append(item);
    });
    const empty = document.getElementById('studio-quick-empty');
    if (empty) {
        empty.hidden = games.length > 0;
        empty.textContent = query ? 'Niciun joc găsit.' : 'Adaugă jocuri cu ★ din Game Center.';
    }
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

function updateConnectionStatus(connected, username, connecting = false, avatarUrl = null, sessionId = null) {
    const status = document.getElementById('tiktok-sync-status');
    const button = document.getElementById('btn-connect');
    const badge = document.getElementById('live-overview-status');

    connectedUsername = connected ? username : null;
    document.getElementById('view-live')?.classList.toggle('is-live-connected', !!connected);
    window.TikInteractLive?.setState({connected:!!connected, connecting:!!connecting, username:username || null, sessionId});
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
            updateConnectionStatus(message.connected, message.username, message.connecting, message.avatarUrl, message.sessionId);
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
            updateConnectionStatus(false, message.username, true, null, message.sessionId);
        } else if (message.type === 'error') {
            showConnectionError(message.message);
        } else if (message.type === 'chat' || message.type === 'gift' || message.type === 'like') {
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
    if (window.TikInteractLive && !window.TikInteractLive.dispatch(event)) return;
    const username = String(event.username || 'utilizator').replace(/^@/, '');
    const isGift = event.type === 'gift';
    const isLike = event.type === 'like';
    const text = isGift ? `a trimis ${event.giftName}` : isLike ? `a trimis ${event.likeCount} like-uri` : event.message;
    if (!text) return;

    totalScore += isGift ? 10 : isLike ? event.likeCount : 1;
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
    const helpDialog = document.getElementById('studio-help-dialog');
    helpDialog?.addEventListener('close', finishStudioTour);
    helpDialog?.addEventListener('click', (event) => {
        if (event.target.hasAttribute('data-tour-advance')) showStudioTourStep(studioTourIndex + 1);
    });
    window.addEventListener('resize', positionStudioTour);
    window.addEventListener('scroll', positionStudioTour, {passive:true});
    const siteHeader = document.querySelector('body > header');
    if (siteHeader) {
        const updateHeaderHeight = () => {
            document.documentElement.style.setProperty('--site-header-height', `${siteHeader.getBoundingClientRect().height}px`);
        };
        updateHeaderHeight();
        if (typeof ResizeObserver !== 'undefined') new ResizeObserver(updateHeaderHeight).observe(siteHeader);
        else window.addEventListener('resize', updateHeaderHeight);
    }
    initializeGameFavorites();
    connectToLocalServer();
    runEngine();
    loadSoundEffectLibrary();
});

window.refreshTikInteractConnectionState = () => {
    if (socket?.readyState === WebSocket.OPEN) {
        socket.send(JSON.stringify({ type: 'state' }));
    }
};
