import { createServer } from 'node:http';
import { randomUUID } from 'node:crypto';
import { readFile, stat } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { WebSocketServer, WebSocket } from 'ws';
import { TikTokLiveConnection, WebcastEvent } from 'tiktok-live-connector';
import { createLiveEventNormalizer, liveViewerCount } from './lib/live-events.js';
import {createGiftCatalog} from './lib/gift-catalog.js';
import {createStudioAuthenticator} from './lib/studio-auth.js';
import {fetchTikTokGiftCatalog} from './lib/tiktok-gift-source.js';
import {maintenanceService} from './lib/maintenance-service.js';
import {nodeMaintenanceHandler,isMaintenancePublic,PRIVATE_HEADERS} from './lib/maintenance-http.js';
import {nodeBillingHandler} from './lib/billing-http.js';
import {nodeAnimationHandler} from './lib/animations-http.js';

const ROOT = path.dirname(fileURLToPath(import.meta.url));
const importedGiftCatalog = JSON.parse(await readFile(path.join(ROOT, 'assets/tiktok-gifts-catalog.json'), 'utf8'));
const knownGiftInfo = new Map(importedGiftCatalog.gifts.map(gift=>[gift.id,gift]));
const supabaseConfig = JSON.parse(await readFile(path.join(ROOT, 'assets/supabase-config.json'), 'utf8'));
const studioAuth = createStudioAuthenticator(supabaseConfig);
const giftCatalog=createGiftCatalog({file:path.join(ROOT,'data/gift-catalog.json'),seedFile:path.join(ROOT,'assets/tiktok-gifts-catalog.json'),
    async fetchGifts(){
        const catalog=await fetchTikTokGiftCatalog({region:process.env.TIKTOK_GIFT_REGION||'RO',connection:liveConnection});
        for(const gift of catalog.gifts)knownGiftInfo.set(gift.id,gift);
        return catalog;
    }});
const HOST = '127.0.0.1';
const PORT = Number(process.env.PORT || 3000);
const ALLOWED_ORIGINS = new Set([
    `http://127.0.0.1:${PORT}`,
    `http://localhost:${PORT}`,
    'https://tikinteract.vercel.app'
]);
const STATIC_FILES = new Set([
    '/index.html',
    '/404.html',
    '/maintenance.html',
    '/live-studio.html',
    '/animation-overlay.html',
    '/admin.html',
    '/style.css',
    '/game.js',
    '/public-info.css',
    '/privacy-policy.html',
    '/terms-of-use.html',
    '/guide.html',
    '/updates.html',
    '/about.html',
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
    '.json': 'application/json; charset=utf-8',
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

// Return the branded page for browser navigation, retaining plain asset errors.
const notFoundPage = await readFile(path.join(ROOT, '404.html'));
const maintenancePage = await readFile(path.join(ROOT, 'maintenance.html'));
function sendNotFound(request, response) {
    const html = request.headers.accept?.includes('text/html');
    response.writeHead(404, {
        'Content-Type': html ? 'text/html; charset=utf-8' : 'text/plain; charset=utf-8',
        'X-Content-Type-Options': 'nosniff',
        'Cache-Control': 'no-store'
    }).end(html ? notFoundPage : 'Not found');
}

const server = createServer(async (request, response) => {
    let pathname;
    try {
        pathname = decodeURIComponent(new URL(request.url, `http://${HOST}:${PORT}`).pathname);
    } catch {
        response.writeHead(400).end('Invalid URL');
        return;
    }

    if (pathname === '/api/maintenance' || pathname === '/api/maintenance/') {
        await nodeMaintenanceHandler(request, response);
        return;
    }
    if (pathname === '/api/billing/webhook') {
        await nodeBillingHandler(request,response);return;
    }
    let gate;
    if (!isMaintenancePublic(pathname)) {
        try {
            const webRequest = new Request(new URL(request.url, `http://${HOST}:${PORT}`), {headers: {cookie: request.headers.cookie || ''}});
            gate = await maintenanceService.gate(webRequest);
        } catch { gate = {allowed:false}; }
        if (!gate.allowed) {
            const html = request.headers.accept?.includes('text/html');
            response.writeHead(503, {...PRIVATE_HEADERS, 'Content-Type':html?'text/html; charset=utf-8':'application/json', 'Retry-After':'3600'});
            response.end(html?maintenancePage:JSON.stringify({error:'MAINTENANCE'}));
            return;
        }
    }

    if (pathname === '/api/billing' || pathname === '/api/billing/') {
        await nodeBillingHandler(request,response);return;
    }
    if (['/api/animations','/api/animations/','/api/animations/worker','/api/animations/overlay'].includes(pathname)) {
        await nodeAnimationHandler(request,response);return;
    }
    if(pathname.startsWith('/GAME/NEON-ASCENT/')){
        const destination=new URL(request.url,`http://${HOST}:${PORT}`);
        destination.pathname=pathname.replace('/GAME/NEON-ASCENT/','/GAME/NOVA-VEX/');
        response.writeHead(308,{Location:destination.pathname+destination.search}).end();return;
    }
    const requestedPath = pathname === '/' ? '/index.html' : pathname;
    const filePath = path.resolve(ROOT, `.${requestedPath}`);
    const assetsPath = path.resolve(ROOT, 'assets');
    const soundsPath = path.resolve(ROOT, 'sounds');
    const isSoundFile = filePath.startsWith(`${soundsPath}${path.sep}`)
        && /\.(aac|flac|m4a|mp3|ogg|wav|webm)$/i.test(filePath);
    const isSkyShiftFile = /^\/GAME\/SKYSHIFT-INTERACT\/(?:index\.html|theme\.css|src\/[a-z-]+\.js|audio\/[a-z-]+\.mp3|art\/(?:source\/)?[a-z0-9-]+\.(?:js|json|png|webp))$/.test(requestedPath);
    const isNovaVexFile = /^\/GAME\/NOVA-VEX\/(?:index\.html|Neon-Ascent\.html|theme\.css|src\/[a-z-]+\.js|audio\/[a-z-]+\.mp3|art\/(?:source\/)?[a-z0-9-]+\.(?:js|json|png|webp))$/.test(requestedPath);
    if (filePath !== ROOT && !filePath.startsWith(`${ROOT}${path.sep}`)) {
        response.writeHead(403).end('Forbidden');
        return;
    }
    const isGameBundle = /^\/GAME\/[A-Za-z0-9_-]+\/[A-Za-z0-9_./-]+\.(?:html|js|css|json|png|webp|jpe?g|svg|avif|gif|mp3|wav|ogg|m4a|mp4|woff2)$/.test(requestedPath);
    if (!STATIC_FILES.has(requestedPath)
        && !filePath.startsWith(`${assetsPath}${path.sep}`)
        && !isSoundFile && !isSkyShiftFile && !isNovaVexFile && !isGameBundle) {
        sendNotFound(request, response);
        return;
    }

    try {
        const immutableMedia = /^\/assets\/game-media\/[a-f0-9]{64}\.(png|jpg|webp|gif|avif|svg|mp3|ogg|wav|m4a)$/.test(requestedPath);
        const etag = immutableMedia ? `"${path.basename(filePath)}"` : null;
        if (etag && request.headers['if-none-match'] === etag) {
            const file = await stat(filePath);
            if (!file.isFile()) { sendNotFound(request, response); return; }
            response.writeHead(304, {'ETag':etag, 'Cache-Control':'public, max-age=31536000, immutable'}).end();
            return;
        }
        const content = await readFile(filePath);
        response.writeHead(200, {
            'Content-Type': MIME_TYPES[path.extname(filePath)] || 'application/octet-stream',
            'X-Content-Type-Options': 'nosniff',
            'Cache-Control': immutableMedia ? 'public, max-age=31536000, immutable' : 'no-store',
            ...(etag ? {'ETag':etag} : {}),
            ...(gate?.enabled || isMaintenancePublic(pathname) ? PRIVATE_HEADERS : {})
        });
        response.end(content);
    } catch (error) {
        if (error.code === 'ENOENT' || error.code === 'EISDIR') {
            sendNotFound(request, response);
            return;
        }
        console.error('Failed to serve request:', error);
        response.writeHead(500).end('Server error');
    }
});

const websocketServer = new WebSocketServer({ noServer: true, maxPayload: 8192 });
const accountRecheckTimer = setInterval(async () => {
    for (const client of websocketServer.clients) {
        const token = client.studioAuth?.token;
        if (!token || client.readyState !== WebSocket.OPEN) continue;
        if (!await studioAuth.authorize(client, token, {force: true})) {
            delete client.studioAuth;
            send(client, {type: 'auth-required', message: 'Accesul contului nu mai poate fi confirmat.'});
            client.close(1008, 'Account access restricted');
        }
    }
    if (liveConnection && ![...websocketServer.clients].some(client => studioAuth.isAuthorized(client))) stopLiveConnection();
}, 10000);
accountRecheckTimer.unref();
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
        if (!studioAuth.isAuthorized(client)) continue;
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
            const giftInfo = kind === 'gift' ? event.extendedGiftInfo || connection.availableGifts?.find(gift => String(gift.id) === String(event.giftId)) || knownGiftInfo.get(String(event.giftId)) : null;
            const normalized = normalize(kind, event, giftInfo);
            if (normalized) broadcast({...normalized, avatarUrl: getProfilePhotoUrl(event.user)});
        });
    }

    let lastAudienceAt=0;
    connection.on(WebcastEvent.ROOM_USER,event=>{
        if(liveConnection!==connection||activeSessionId!==sessionId||connectionStatus!=='connected')return;
        const viewerCount=liveViewerCount(event);
        if(viewerCount===null||Date.now()-lastAudienceAt<1000)return;
        lastAudienceAt=Date.now();broadcast({type:'audience',viewerCount,sessionId});
    });
    connection.on(WebcastEvent.STREAM_END, () => {
        if (liveConnection === connection) {
            stopLiveConnection();
        }
    });

    try {
        await connection.connect();
        if (attempt === connectionAttempt && liveConnection === connection) {
            connectionStatus = 'connected';
            giftCatalog.ingest(connection.availableGifts,username).then(catalog=>broadcast({type:'gift-catalog',...catalog})).catch(error=>console.warn('Gift catalog cache:',error.message));
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

    socket.on('message', async (rawMessage) => {
        let message;
        try {
            message = JSON.parse(rawMessage.toString());
        } catch {
            send(socket, { type: 'error', message: 'Mesaj invalid primit de la interfață.' });
            return;
        }

        if (!message || typeof message !== 'object' || !await studioAuth.authorize(socket, message.accessToken)) {
            delete socket.studioAuth;
            send(socket, {type: 'auth-required', message: 'Autentifică-te în cont pentru a folosi LIVE Studio.'});
            socket.close(1008, 'Authentication required');
            return;
        }
        if (socket.readyState !== WebSocket.OPEN) return;

        if (message.type === 'gift-catalog') {
            const username=String(message.username||activeUsername||'').trim().replace(/^@/,'');
            if(username&&!/^[A-Za-z0-9._]{2,24}$/.test(username))return;
            const requestedAt=Date.now();
            if(socket.lastGiftCatalogRequest&&requestedAt-socket.lastGiftCatalogRequest<5000){send(socket,{type:'gift-catalog',gifts:[],error:'Așteaptă câteva secunde înainte de următoarea sincronizare.'});return;}
            socket.lastGiftCatalogRequest=requestedAt;
            giftCatalog.get(username,{refresh:message.refresh===true}).then(catalog=>send(socket,{type:'gift-catalog',...catalog})).catch(()=>send(socket,{type:'gift-catalog',gifts:[],error:'Catalogul nu este disponibil momentan.'}));
        } else if (message.type === 'profile') {
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
    clearInterval(accountRecheckTimer);
    stopLiveConnection();
    for (const client of websocketServer.clients) {
        client.terminate();
    }
    websocketServer.close();
    server.close(() => process.exit(0));
}

process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
