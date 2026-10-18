// Add this SDK to future games, then register callbacks with TikInteractGame.
(() => {
    const CHANNEL = 'tikinteract-live';
    let handlers = null, token = null;
    const bootstrapToken = /[?&]tikinteractHost=([a-f0-9-]+)/i.exec(location.search || '')?.[1];
    let state = {connected:false, connecting:false, username:null, sessionId:null};
    const seen = new Set();
    const replyReady = () => parent.postMessage({channel:CHANNEL, version:1, type:'ready', token, viewport:handlers?.viewport}, location.origin);
    function register(callbacks) {
        handlers = callbacks;
        if (token) replyReady();
        else if (bootstrapToken && parent !== window) parent.postMessage({channel:CHANNEL, version:1, type:'available', token:bootstrapToken}, location.origin);
    }
    window.addEventListener('message', message => {
        const data = message.data;
        if (parent === window || message.source !== parent || message.origin !== location.origin || data?.channel !== CHANNEL || data.version !== 1) return;
        if (data.type === 'init' && typeof data.token === 'string') {
            if (bootstrapToken && data.token !== bootstrapToken) return;
            token = data.token;
            seen.clear();
            if (handlers) replyReady();
            return;
        }
        if (!token || data.token !== token || !handlers) return;
        if (data.type === 'status') {
            if (state.sessionId !== data.state?.sessionId || !data.state?.connected) seen.clear();
            state = {...data.state};
            handlers.onStatus?.(state);
        } else if (data.type === 'event') {
            const event = data.event;
            if (!state.connected || !state.sessionId || event?.sessionId !== state.sessionId || !['chat','like','gift'].includes(event?.type) || !event.eventId || seen.has(event.eventId)) return;
            seen.add(event.eventId);
            if (seen.size > 10000) seen.delete(seen.values().next().value);
            const handler = handlers[{chat:'onChat',like:'onLike',gift:'onGift'}[event.type]] || handlers.onEvent;
            handler?.(event);
        }
    });
    function toLegacyEvent(event) {
        return {event:event.type, eventId:event.eventId, data:{
            eventId:event.eventId, msgId:event.eventId,
            userId:event.username, uniqueId:event.username, nickname:event.displayName || event.username,
            comment:event.message, likeCount:event.likeCount,
            diamondCount:event.diamondCount || 1, repeatCount:event.repeatCount,
            giftType:event.giftType, repeatEnd:true, giftName:event.giftName
        }};
    }
    window.TikInteractGame = Object.freeze({version:1, register, toLegacyEvent});
})();
