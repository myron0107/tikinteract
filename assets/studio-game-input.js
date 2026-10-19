// Keep manual game controls usable when keyboard focus is on the Studio panel.
(() => {
    const frame = document.getElementById('live-game-frame');
    if (!frame) return;
    const held = new Set();
    const codes = ['KeyA', 'KeyD', 'ArrowLeft', 'ArrowRight'];
    let activeApi = null;
    const codeFor = event => codes.includes(event.code) ? event.code : ({a:'KeyA', d:'KeyD', ArrowLeft:'ArrowLeft', ArrowRight:'ArrowRight'}[event.key?.length === 1 ? event.key.toLowerCase() : event.key]);
    const typing = target => target?.isContentEditable || target?.closest?.('input,textarea,select,[role="textbox"],[role="slider"]');
    function controls() {
        if (document.hidden || frame.hidden || document.getElementById('live-studio-panel')?.classList.contains('hidden') || document.querySelector('dialog[open],#auth-modal:not(.hidden)')) return null;
        try {
            const api = frame.contentWindow?.TikInteractStudioControls;
            return typeof api?.setInput === 'function' ? api : null;
        } catch { return null; }
    }
    function release() {
        held.clear();
        try { activeApi?.setInput({left:false, right:false}); } catch { /* A replaced frame may already be gone. */ }
        activeApi = null;
    }
    function send() {
        activeApi?.setInput({left:held.has('KeyA') || held.has('ArrowLeft'), right:held.has('KeyD') || held.has('ArrowRight')});
    }
    document.addEventListener('keydown', event => {
        const code = codeFor(event);
        if (!code || event.defaultPrevented || event.ctrlKey || event.metaKey || event.altKey || event.isComposing || typing(event.target)) return;
        if (code.startsWith('Arrow') && event.target?.closest?.('[role="tablist"],[role="listbox"]')) return;
        const api = controls();
        if (!api) { release(); return; }
        if (activeApi !== api) { release(); activeApi = api; }
        held.add(code); send(); event.preventDefault();
    });
    document.addEventListener('keyup', event => {
        const code = codeFor(event);
        if (!held.delete(code)) return;
        send(); event.preventDefault();
    });
    window.addEventListener('blur', release);
    window.addEventListener('pagehide', release);
    document.addEventListener('visibilitychange', () => { if (document.hidden) release(); });
    document.addEventListener('focusin', event => { if (typing(event.target)) release(); });
    new MutationObserver(release).observe(frame, {attributes:true, attributeFilter:['src','hidden']});
    const workspace = document.getElementById('live-studio-panel');
    if (workspace) new MutationObserver(() => { if (!controls()) release(); }).observe(workspace, {attributes:true, attributeFilter:['class']});
    for (const id of ['studio-help-dialog','auth-modal']) {
        const dialog = document.getElementById(id);
        if (dialog) new MutationObserver(() => { if (!controls()) release(); }).observe(dialog, {attributes:true, attributeFilter:['open','class']});
    }
})();
