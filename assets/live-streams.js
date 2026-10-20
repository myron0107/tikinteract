// TikInteract - Live Streams Directory
// Displays streamers currently LIVE on TikTok playing TikInteract interactive games.

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

let cachedStreams = [];
let activeStreamsFilter = 'all';
let streamsSearchQuery = '';
let streamsAutoRefreshTimer = null;
let streamsRequestId = 0;

function escapeHtml(str) {
    if (!str) return '';
    return String(str)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
}

function getGameMeta(gameId) {
    const platformGame = window.TikInteractPlatform?.getGame(gameId);
    if (platformGame) {
        return {
            id: platformGame.id,
            name: platformGame.name,
            badge: platformGame.plan === 'free' ? 'Gratuit' : 'Play Pass',
            cover: platformGame.cover,
            icon: 'fa-gamepad'
        };
    }
    return KNOWN_GAMES_META[gameId] || {
        id: gameId || 'neon-race-2',
        name: (gameId || 'NEON INTERACT').toUpperCase().replace(/-/g, ' '),
        badge: 'LIVE',
        cover: 'assets/game-gallery/neon-interact-cover.webp?v=2',
        icon: 'fa-gamepad'
    };
}

function formatStreamDuration(startedAt) {
    if (!startedAt) return 'LIVE acum';
    const start = new Date(startedAt).getTime();
    if (isNaN(start)) return 'LIVE acum';
    const diffMinutes = Math.max(1, Math.floor((Date.now() - start) / 60000));
    if (diffMinutes < 60) return `În direct de ${diffMinutes}m`;
    const hours = Math.floor(diffMinutes / 60);
    const mins = diffMinutes % 60;
    return `În direct de ${hours}h ${mins}m`;
}

function createStreamCardHtml(stream) {
    const game = getGameMeta(stream.current_game || 'neon-race-2');
    const username = stream.tiktok_username || 'creator';
    const displayName = stream.tiktok_display_name || username;
    const initial = (displayName.charAt(0) || username.charAt(0) || 'T').toUpperCase();

    const avatarHtml = stream.avatar_url
        ? `<img src="${escapeHtml(stream.avatar_url)}" alt="${escapeHtml(displayName)}" class="stream-avatar-img" referrerpolicy="no-referrer" onerror="this.classList.add('hidden');if(this.nextElementSibling)this.nextElementSibling.classList.remove('hidden');"><span class="stream-avatar-fallback hidden">${initial}</span>`
        : `<span class="stream-avatar-fallback">${initial}</span>`;

    const durationText = formatStreamDuration(stream.started_at);
    const coins = Number(stream.total_coins) || 0;
    const coinsHtml = coins > 0
        ? `<div class="stream-stats-badge" title="${coins.toLocaleString('ro-RO')} monede strânse în această sesiune">
             <i class="fa-solid fa-coins text-amber-400" aria-hidden="true"></i>
             <span>${coins.toLocaleString('ro-RO')}</span>
           </div>`
        : '';

    return `
        <article class="stream-card" data-game="${escapeHtml(stream.current_game || 'neon-race-2')}">
            <div class="stream-card-media">
                <img src="${escapeHtml(game.cover)}" alt="${escapeHtml(game.name)}" class="stream-card-cover" loading="lazy">
                <div class="stream-card-overlay"></div>
                <div class="stream-card-badges">
                    <span class="stream-live-pill">
                        <span class="stream-live-dot" aria-hidden="true"></span>
                        LIVE
                    </span>
                    <span class="stream-game-tag">
                        <i class="fa-solid ${game.icon || 'fa-gamepad'}" aria-hidden="true"></i>
                        ${escapeHtml(game.name)}
                    </span>
                </div>
                <div class="stream-card-duration">
                    <i class="fa-regular fa-clock" aria-hidden="true"></i>
                    <span>${durationText}</span>
                </div>
            </div>
            <div class="stream-card-content">
                <div class="stream-creator-header">
                    <div class="stream-avatar-wrap">
                        ${avatarHtml}
                    </div>
                    <div class="stream-creator-info">
                        <h3 class="stream-creator-name" title="${escapeHtml(displayName)}">
                            ${escapeHtml(displayName)}
                        </h3>
                        <p class="stream-creator-handle">@${escapeHtml(username)}</p>
                    </div>
                    ${coinsHtml}
                </div>
                <div class="stream-card-actions">
                    <a href="https://www.tiktok.com/@${encodeURIComponent(username)}/live"
                       target="_blank" rel="noopener noreferrer"
                       class="stream-tiktok-btn">
                        <i class="fa-brands fa-tiktok" aria-hidden="true"></i>
                        <span>Urmărește LIVE</span>
                    </a>
                    <button type="button"
                            onclick="launchGameFromStream('${escapeHtml(stream.current_game || 'neon-race-2')}')"
                            class="stream-game-action-btn"
                            title="Joacă acest joc în Studio">
                        <i class="fa-solid fa-gamepad" aria-hidden="true"></i>
                        <span>Joacă</span>
                    </button>
                </div>
            </div>
        </article>
    `;
}

async function fetchLiveStreamsFromData() {
    const supabase = window.tikInteractSupabase;
    let list = [];

    if (supabase) {
        try {
            const { data, error } = await supabase.rpc('get_active_live_streams');
            if (!error && Array.isArray(data)) {
                list = data;
            }
        } catch (err) {
            console.warn('RPC get_active_live_streams unavailable:', err.message);
        }
    }

    // Include local active session if connected in current browser
    const localUsername = window.tikInteractStreamerUsername
        || (window.tikInteractStatus?.connected ? window.tikInteractStatus?.username : null);
    const localGame = document.getElementById('live-game-select')?.value
        || document.getElementById('live-game-frame')?.dataset?.gameId
        || 'neon-race-2';

    if (localUsername && !list.some(s => s.tiktok_username?.toLowerCase() === localUsername.toLowerCase())) {
        list.unshift({
            tiktok_username: localUsername,
            tiktok_display_name: localUsername,
            avatar_url: window.tikInteractStreamerAvatar || null,
            current_game: localGame,
            started_at: new Date().toISOString(),
            total_coins: 0
        });
    }

    return list;
}

function renderStreamsList() {
    const grid = document.getElementById('streams-grid');
    const emptyState = document.getElementById('streams-empty-state');
    const countLabel = document.getElementById('streams-count-label');
    const statusText = document.getElementById('streams-status-text');

    if (!grid) return;

    let filtered = cachedStreams.slice();

    if (activeStreamsFilter !== 'all') {
        filtered = filtered.filter(s => (s.current_game || 'neon-race-2') === activeStreamsFilter);
    }

    if (streamsSearchQuery.trim()) {
        const query = streamsSearchQuery.trim().toLowerCase();
        filtered = filtered.filter(s =>
            (s.tiktok_username || '').toLowerCase().includes(query) ||
            (s.tiktok_display_name || '').toLowerCase().includes(query)
        );
    }

    if (countLabel) {
        countLabel.textContent = `${filtered.length} ${filtered.length === 1 ? 'streamer activ' : 'streameri activi'}`;
    }

    if (statusText) {
        statusText.innerHTML = `
            <span class="inline-block w-2 h-2 rounded-full bg-green-500 animate-pulse"></span>
            <span>Actualizat la ${new Date().toLocaleTimeString('ro-RO', {hour:'2-digit', minute:'2-digit', second:'2-digit'})}</span>
        `;
    }

    if (filtered.length === 0) {
        grid.innerHTML = '';
        if (emptyState) emptyState.classList.remove('hidden');
        return;
    }

    if (emptyState) emptyState.classList.add('hidden');
    grid.innerHTML = filtered.map(createStreamCardHtml).join('');
}

export async function loadLiveStreams(force = false) {
    const grid = document.getElementById('streams-grid');
    const statusText = document.getElementById('streams-status-text');
    const emptyState = document.getElementById('streams-empty-state');
    const curRequestId = ++streamsRequestId;

    if (grid && (!cachedStreams.length || force)) {
        statusText && (statusText.innerHTML = `<span class="inline-block w-2 h-2 rounded-full bg-amber-400 animate-ping"></span><span>Căutăm streamuri active…</span>`);
    }

    try {
        const data = await fetchLiveStreamsFromData();
        if (curRequestId !== streamsRequestId) return;
        cachedStreams = data;
        renderStreamsList();
    } catch (err) {
        console.error('Failed to load active live streams:', err);
        if (statusText) {
            statusText.innerHTML = `<span class="text-red-400">Nu am putut actualiza streamurile. Încearcă din nou.</span>`;
        }
    }
}

export async function loadHomeStreamsPreview() {
    const container = document.getElementById('home-streams-list');
    if (!container) return;

    try {
        const data = await fetchLiveStreamsFromData();
        cachedStreams = data;

        if (!data || data.length === 0) {
            container.innerHTML = `
                <div class="col-span-full home-stream-empty-banner">
                    <div class="home-stream-empty-icon"><i class="fa-solid fa-satellite-dish" aria-hidden="true"></i></div>
                    <div class="home-stream-empty-text">
                        <h3 class="text-base font-bold text-white mb-1">Niciun streamer nu este LIVE în acest moment</h3>
                        <p class="text-xs text-zinc-400">Fii primul care pornește transmisiunea! Deschide LIVE Studio, conectează-te și apari aici automat.</p>
                    </div>
                    <button type="button" onclick="checkAccessAndGo('live')" class="home-primary-button text-xs py-2.5 px-5 whitespace-nowrap">
                        <i class="fa-solid fa-tower-broadcast mr-1.5" aria-hidden="true"></i> Fă LIVE acum
                    </button>
                </div>
            `;
            return;
        }

        const topThree = data.slice(0, 3);
        container.innerHTML = topThree.map(createStreamCardHtml).join('');
    } catch (err) {
        console.warn('Could not load home streams preview:', err);
    }
}

export function setStreamsGameFilter(filter) {
    activeStreamsFilter = filter;
    document.querySelectorAll('[data-game-filter]').forEach(button => {
        const isActive = button.dataset.gameFilter === filter;
        button.classList.toggle('is-active', isActive);
        button.setAttribute('aria-pressed', String(isActive));
    });
    renderStreamsList();
}

export function handleStreamFilterChange() {
    const input = document.getElementById('streams-search-input');
    streamsSearchQuery = input ? input.value : '';
    renderStreamsList();
}

export function launchGameFromStream(gameId) {
    if (typeof window.checkAccessAndGo === 'function') {
        window.requestedLiveGame = gameId;
        window.checkAccessAndGo('live');
    } else {
        window.location.assign('live-studio.html?game=' + encodeURIComponent(gameId));
    }
}

// Global attachments for inline handlers
window.loadLiveStreams = loadLiveStreams;
window.loadHomeStreamsPreview = loadHomeStreamsPreview;
window.setStreamsGameFilter = setStreamsGameFilter;
window.handleStreamFilterChange = handleStreamFilterChange;
window.launchGameFromStream = launchGameFromStream;

// Auto-refresh poll when view-streams is visible
if (typeof window !== 'undefined') {
    clearInterval(streamsAutoRefreshTimer);
    streamsAutoRefreshTimer = setInterval(() => {
        const streamsView = document.getElementById('view-streams');
        if (streamsView && !streamsView.classList.contains('hidden')) {
            loadLiveStreams(false);
        }
    }, 20000);
}

