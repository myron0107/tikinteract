// Preserve the existing racing rules while using Studio's single LIVE source.
(() => {
    if (parent === window || !window.TikInteractGame || typeof window.liveEvent !== 'function') return;
    const disconnect = document.getElementById('liveDisconnect') || document.getElementById('disconnect');
    disconnect?.click();
    window.TikInteractGame.register({
        viewport: {width:540, height:960},
        onEvent(event) { window.liveEvent(JSON.stringify(window.TikInteractGame.toLegacyEvent(event))); },
        onStatus(state) {
            const status = document.getElementById('liveStatus');
            if (status) status.textContent = state.connected ? `● TIKINTERACT LIVE · @${state.username}` : state.connecting ? '● CONECTARE TIKINTERACT' : '● OFFLINE · Conectează LIVE-ul din Studio';
        }
    });
})();
