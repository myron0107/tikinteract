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
    const accountTikTok = document.getElementById('account-tiktok-username');
    if (accountTikTok && username) accountTikTok.textContent = `@${username.replace(/^@/, '')}`;

    const supabase = window.tikInteractSupabase;
    if (!window.tikInteractUser || !supabase) {
        const status = document.getElementById('tiktok-sync-status');
        if (status) {
            status.textContent = 'Conectează-te la contul TikInteract pentru a salva profilul în clasament.';
            status.className = 'mb-4 text-[10px] font-bold uppercase tracking-[0.14em] text-amber-400';
        }
        return false;
    }

    const isPublic = Boolean(document.getElementById('leaderboard-public')?.checked);
    const { error } = await supabase.rpc('save_my_streamer_profile', {
        p_tiktok_username: username.replace(/^@/, ''),
        p_tiktok_display_name: displayName || username.replace(/^@/, ''),
        p_avatar_url: avatarUrl,
        p_is_public: isPublic
    });
    if (error) throw error;
    return isPublic;
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
    if (!data) return;

    const input = document.getElementById('tiktok-user');
    const publicToggle = document.getElementById('leaderboard-public');
    if (input) input.value = `@${data.tiktok_username}`;
    const accountTikTok = document.getElementById('account-tiktok-username');
    if (accountTikTok) accountTikTok.textContent = `@${data.tiktok_username}`;
    if (publicToggle) publicToggle.checked = data.is_public;
    setStreamerProfile(data.tiktok_username, data.avatar_url, data.tiktok_display_name);
}

function saveTikTokProfileFromSettings() {
    const input = document.getElementById('tiktok-user');
    if (!input) return;
    const username = input.value.trim().replace(/^@/, '');
    saveTikTokLeaderboardProfile(username).then((isPublic) => {
        const status = document.getElementById('tiktok-sync-status');
        if (status && !connectedUsername) {
            status.textContent = isPublic
                ? 'Profil salvat și publicat în clasament.'
                : 'Profil salvat privat. Activează opțiunea pentru clasamentul public.';
            status.className = 'mb-4 text-[10px] font-bold uppercase tracking-[0.14em] text-green-400';
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

function clearStreamerProfile() {
    const profile = document.getElementById('tiktok-profile');
    const profileImage = document.getElementById('tiktok-profile-image');
    if (profile) profile.classList.add('hidden');
    if (profileImage) profileImage.removeAttribute('src');
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
});

window.refreshTikInteractConnectionState = () => {
    if (socket?.readyState === WebSocket.OPEN) {
        socket.send(JSON.stringify({ type: 'state' }));
    }
};