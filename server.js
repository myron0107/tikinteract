import { createServer } from 'node:http';
import { randomUUID } from 'node:crypto';
import { readFile, stat } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { WebSocketServer, WebSocket } from 'ws';
import { TikTokLiveConnection, WebcastEvent } from 'tiktok-live-connector';
import { createLiveEventNormalizer } from './lib/live-events.js';

const ROOT = path.dirname(fileURLToPath(import.meta.url));
const HOST = '127.0.0.1';
const PORT = Number(process.env.PORT || 3000);
const ALLOWED_ORIGINS = new Set([
    `http://127.0.0.1:${PORT}`,
    `http://localhost:${PORT}`,
    'https://tikinteract.vercel.app'
]);
const STATIC_FILES = new Set([
    '/index.html',
    '/style.css',
    '/game.js',
    '/public-info.css',
    '/privacy-policy.html',
    '/terms-of-use.html',
    '/guide.html',
    '/updates.html',
    '/GAME/game-pages.css',
    '/GAME/NEON-RACE/index.html',
    '/GAME/NEON-RACE/Neon-Race.html',
    '/GAME/NEON-INTERACT/index.html',
    '/GAME/NEON-INTERACT/Neon-Interact.html',
    '/GAME/MOTO-INTERACT/index.html',
    '/GAME/MOTO-INTERACT/Moto-Interact.html',
    '/GAME/NEON-RIDERS/index.html',
    '/GAME/NEON-RIDERS/NEON-RIDERS.html',
    '/GAME/COUNTRY-DERBY/index.html',
    '/GAME/COUNTRY-DERBY/COUNTRY-DERBY.html'
]);
const MIME_TYPES = {
    '.css': 'text/css; charset=utf-8',
    '.html': 'text/html; charset=utf-8',
    '.js': 'text/javascript; charset=utf-8',
    '.aac': 'audio/aac',
    '.flac': 'audio/flac',
    '.m4a': 'audio/mp4',
    '.mp3': 'audio/mpeg',
    '.ogg': 'audio/ogg',
    '.png': 'image/png',
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.webp': 'image/webp',
    '.gif': 'image/gif',
    '.avif': 'image/avif',
    '.mp4': 'video/mp4',
    '.svg': 'image/svg+xml',
    '.wav': 'audio/wav',
    '.webm': 'audio/webm',
    '.woff2': 'font/woff2'
};

const server = createServer(async (request, response) => {
    let pathname;
    try {
        pathname = decodeURIComponent(new URL(request.url, `http://${HOST}:${PORT}`).pathname);
    } catch {
        response.writeHead(400).end('Invalid URL');
        return;
    }

    const requestedPath = pathname === '/' ? '/index.html' : pathname;
    const filePath = path.resolve(ROOT, `.${requestedPath}`);
    const assetsPath = path.resolve(ROOT, 'assets');
    const soundsPath = path.resolve(ROOT, 'sounds');
    const isSoundFile = filePath.startsWith(`${soundsPath}${path.sep}`)
        && /\.(aac|flac|m4a|mp3|ogg|wav|webm)$/i.test(filePath);
    if (filePath !== ROOT && !filePath.startsWith(`${ROOT}${path.sep}`)) {
        response.writeHead(403).end('Forbidden');
        return;
    }
    if (!STATIC_FILES.has(requestedPath)
        && !filePath.startsWith(`${assetsPath}${path.sep}`)
        && !isSoundFile) {
        response.writeHead(404).end('Not found');
        return;
    }

    try {
        const immutableMedia = /^\/assets\/game-media\/[a-f0-9]{64}\.(png|jpg|webp|gif|avif|svg|mp3|ogg|wav|m4a)$/.test(requestedPath);
        const etag = immutableMedia ? `"${path.basename(filePath)}"` : null;
        if (etag && request.headers['if-none-match'] === etag) {
            const file = await stat(filePath);
            if (!file.isFile()) { response.writeHead(404).end('Not found'); return; }
            response.writeHead(304, {'ETag':etag, 'Cache-Control':'public, max-age=31536000, immutable'}).end();
            return;
        }
        const content = await readFile(filePath);
        response.writeHead(200, {
            'Content-Type': MIME_TYPES[path.extname(filePath)] || 'application/octet-stream',
            'X-Content-Type-Options': 'nosniff',
            'Cache-Control': immutableMedia ? 'public, max-age=31536000, immutable' : 'no-store',
            ...(etag ? {'ETag':etag} : {})
        });
        response.end(content);
    } catch (error) {
        if (error.code === 'ENOENT' || error.code === 'EISDIR') {
            response.writeHead(404).end('Not found');
            return;
        }
        console.error('Failed to serve request:', error);
        response.writeHead(500).end('Server error');
    }
});

const websocketServer = new WebSocketServer({ noServer: true, maxPayload: 4096 });
let liveConnection = null;
let activeUsername = null;
let connectionAttempt = 0;
let connectionStatus = 'disconnected';
let activeSessionId = null;

function send(socket, message) {
    if (socket.readyState === WebSocket.OPEN) {
        socket.send(JSON.stringify(message));
    }
}

function broadcast(message) {
    for (const client of websocketServer.clients) {
        send(client, message);
    }
}

function getState() {
    return {
        type: 'status',
        connected: connectionStatus === 'connected',
        connecting: connectionStatus === 'connecting',
        username: activeUsername,
        sessionId: activeSessionId,
        avatarUrl: liveConnection ? getProfilePhotoUrl(liveConnection.roomInfo?.data?.owner, liveConnection.roomInfo?.data?.user) : null
    };
}

function getProfilePhotoUrl(...users) {
    for (const user of users) {
        const avatar = user?.avatarLarger || user?.avatar_larger
            || user?.avatarMedium || user?.avatar_medium
            || user?.avatarThumb || user?.avatar_thumb
            || user?.profilePictureUrl || user?.profile_picture_url;
        const candidate = typeof avatar === 'string'
            ? avatar
            : avatar?.urlList?.[0] || avatar?.url_list?.[0] || avatar?.urls?.[0];
        if (!candidate) continue;

        try {
            const url = new URL(candidate);
            if (url.protocol === 'https:') return url.href;
        } catch {
            continue;
        }
    }
    return null;
}

async function sendTikTokProfile(socket, rawUsername) {
    const username = String(rawUsername || '').trim().replace(/^@/, '');
    if (!/^[A-Za-z0-9._]{2,24}$/.test(username)) {
        send(socket, { type: 'profile-error', username, message: 'Introdu un username TikTok valid.' });
        return;
    }

    const connection = new TikTokLiveConnection(username, {});
    try {
        const roomInfo = await connection.fetchRoomInfo();
        const owner = roomInfo?.data?.owner;
        const avatarUrl = getProfilePhotoUrl(owner);
        send(socket, {
            type: 'profile',
            username,
            displayName: owner?.nickname || username,
            avatarUrl
        });
    } catch (error) {
        send(socket, {
            type: 'profile-error',
            username,
            message: error instanceof Error ? error.message : 'Nu am putut încărca profilul TikTok.'
        });
    } finally {
        await connection.disconnect();
    }
}

function stopLiveConnection() {
    connectionAttempt += 1;
    const connection = liveConnection;
    liveConnection = null;
    activeUsername = null;
    connectionStatus = 'disconnected';
    activeSessionId = null;

    if (connection) {
        try {
            Promise.resolve(connection.disconnect()).catch((error) => {
                console.error('Failed to disconnect from TikTok LIVE:', error);
            });
        } catch (error) {
            console.error('Failed to disconnect from TikTok LIVE:', error);
        }
    }

    broadcast({ type: 'status', connected: false, username: null, sessionId: null });
}

async function startLiveConnection(rawUsername) {
    const username = String(rawUsername || '').trim().replace(/^@/, '');
    if (!/^[A-Za-z0-9._]{2,24}$/.test(username)) {
        throw new Error('Username-ul trebuie să conțină 2-24 caractere: litere, cifre, punct sau underscore.');
    }

    stopLiveConnection();
    const attempt = connectionAttempt;
    const connection = new TikTokLiveConnection(username, { enableExtendedGiftInfo: true });
    liveConnection = connection;
    activeUsername = username;
    connectionStatus = 'connecting';
    const sessionId = randomUUID();
    activeSessionId = sessionId;
    const normalize = createLiveEventNormalizer(sessionId);
    broadcast({ type: 'connecting', username, sessionId });

    for (const [kind, webcastEvent] of [['chat', WebcastEvent.CHAT], ['like', WebcastEvent.LIKE], ['gift', WebcastEvent.GIFT]]) {
        connection.on(webcastEvent, (event) => {
            if (liveConnection !== connection || activeSessionId !== sessionId || connectionStatus !== 'connected') return;
            const giftInfo = kind === 'gift' ? event.extendedGiftInfo || connection.availableGifts?.find(gift => String(gift.id) === String(event.giftId)) : null;
            const normalized = normalize(kind, event, giftInfo);
            if (normalized) broadcast({...normalized, avatarUrl: getProfilePhotoUrl(event.user)});
        });
    }

    connection.on(WebcastEvent.STREAM_END, () => {
        if (liveConnection === connection) {
            stopLiveConnection();
        }
    });

    try {
        await connection.connect();
        if (attempt === connectionAttempt && liveConnection === connection) {
            connectionStatus = 'connected';
            broadcast({
                type: 'status',
                connected: true,
                username,
                sessionId,
                avatarUrl: getProfilePhotoUrl(connection.roomInfo?.data?.owner, connection.roomInfo?.data?.user)
            });
        }
    } catch (error) {
        if (attempt === connectionAttempt && liveConnection === connection) {
            liveConnection = null;
            activeUsername = null;
            connectionStatus = 'disconnected';
            activeSessionId = null;
            broadcast({
                type: 'error',
                message: error instanceof Error ? error.message : 'Conectarea la LIVE a eșuat.'
            });
            broadcast({ type: 'status', connected: false, username: null, sessionId: null });
        }
    }
}

websocketServer.on('connection', (socket, request) => {
    const origin = request.headers.origin;
    if (origin && !ALLOWED_ORIGINS.has(origin)) {
        socket.close(1008, 'Origin not allowed');
        return;
    }

    send(socket, getState());
    socket.on('message', (rawMessage) => {
        let message;
        try {
            message = JSON.parse(rawMessage.toString());
        } catch {
            send(socket, { type: 'error', message: 'Mesaj invalid primit de la interfață.' });
            return;
        }

        if (message.type === 'profile') {
            sendTikTokProfile(socket, message.username).catch((error) => {
                send(socket, {
                    type: 'profile-error',
                    username: String(message.username || ''),
                    message: error instanceof Error ? error.message : 'Nu am putut încărca profilul TikTok.'
                });
            });
        } else if (message.type === 'connect') {
            startLiveConnection(message.username).catch((error) => {
                send(socket, {
                    type: 'error',
                    message: error instanceof Error ? error.message : 'Conectarea a eșuat.'
                });
            });
        } else if (message.type === 'disconnect') {
            stopLiveConnection();
        } else if (message.type === 'state') {
            send(socket, getState());
        }
    });
});

server.on('upgrade', (request, socket, head) => {
    if (request.url !== '/ws') {
        socket.destroy();
        return;
    }
    websocketServer.handleUpgrade(request, socket, head, (websocket) => {
        websocketServer.emit('connection', websocket, request);
    });
});

server.listen(PORT, HOST, () => {
    console.log(`TikInteract is ready at http://${HOST}:${PORT}`);
});

function shutdown() {
    stopLiveConnection();
    for (const client of websocketServer.clients) {
        client.terminate();
    }
    websocketServer.close();
    server.close(() => process.exit(0));
}

process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
