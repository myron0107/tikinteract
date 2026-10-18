// Host half of the versioned game protocol. No game-specific event rules here.
(() => {
    const CHANNEL = 'tikinteract-live';
    let frame = null, token = null, ready = false, onReady = null;
    let state = {connected:false, connecting:false, username:null, sessionId:null};
    let pending = [];
    const seen = new Set();
    function send(type, payload) {
        frame?.contentWindow?.postMessage({channel:CHANNEL, version:1, type, token, ...payload}, location.origin);
    }
    function prepare(nextFrame, callback = null) {
        frame = nextFrame;
        token = crypto.randomUUID();
        ready = false;
        pending = [];
        onReady = callback;
        return token;
    }
    function detach() { frame = null; token = null; ready = false; pending = []; onReady = null; }
    function loaded(nextFrame) {
        if (nextFrame !== frame || !frame?.dataset.gameId || ready) return;
        send('init', {state});
    }
    function setState(next) {
        if (state.sessionId !== next.sessionId || !next.connected) { pending = []; seen.clear(); }
        state = {...next};
        if (ready) send('status', {state});
    }
    function dispatch(event) {
        if (!state.connected || !state.sessionId || event.sessionId !== state.sessionId || !['chat','like','gift'].includes(event.type)) return false;
        if (!event.eventId || seen.has(event.eventId)) return false;
        seen.add(event.eventId);
        if (seen.size > 10000) seen.delete(seen.values().next().value);
        if (!frame) return true;
        if (ready) send('event', {event});
        else {
            pending.push(event);
            if (pending.length > 250) pending.shift();
        }
        return true;
    }
    window.addEventListener('message', message => {
        const data = message.data;
        if (!frame || message.source !== frame.contentWindow || message.origin !== location.origin || data?.channel !== CHANNEL || data.version !== 1 || data.token !== token || ready) return;
        if (data.type === 'available') { send('init', {state}); return; }
        if (data.type !== 'ready') return;
        ready = true;
        send('status', {state});
        onReady?.(data.viewport);
        const events = pending;
        pending = [];
        for (const event of events) if (state.connected && event.sessionId === state.sessionId && Date.now()-event.timestamp < 5000) send('event', {event});
    });
    window.TikInteractLive = Object.freeze({prepare, loaded, detach, setState, dispatch});
})();
