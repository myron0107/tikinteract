let totalScore = 0;
let items = [];
let socket = null;
let giftCount = 0;
let connectedUsername = null;

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
        } else if (message.type === 'profile') {
            setStreamerProfile(message.username, message.avatarUrl, message.displayName);
            const status = document.getElementById('tiktok-sync-status');
            if (status && !connectedUsername) {
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