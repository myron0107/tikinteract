// Apply saved preferences before the first paint. Reveal only the finished UI,
// without waiting for game art, audio, analytics or the window's load event.
(() => {
    const root = document.documentElement;
    const studio = root.dataset.paletteScope === 'studio';
    const read = key => { try { return localStorage.getItem(key); } catch { return null; } };
    const requested = new URLSearchParams(location.search).get('lang');
    const language = ['ro', 'en'].includes(requested) ? requested : read('tikinteract_language') === 'en' ? 'en' : 'ro';
    const mode = read('tikinteract_mode') === 'light' ? 'light' : 'dark';
    const theme = studio && read('tikinteract_brand') === 'blue' ? 'blue' : 'burgundy';
    root.lang = language;
    root.dataset.mode = mode;
    root.dataset.theme = theme;
    root.classList.toggle('dark', mode === 'dark');
    root.dataset.uiPending = '';
    root.setAttribute('aria-busy', 'true');
    const finished = new Set();
    let revealed = false, preparing = false;
    function reveal(reason) {
        if (revealed) return;
        revealed = true;
        clearTimeout(fallback);
        delete root.dataset.uiPending;
        root.removeAttribute('aria-busy');
        root.dataset.uiReady = reason;
        window.dispatchEvent(new CustomEvent('tikinteract:ui-ready', {detail: {reason}}));
    }
    function check() {
        if (revealed || preparing || !finished.has('language') || !finished.has('layout')) return;
        if (studio && (!finished.has('auth') || (window.tikInteractUser && !window.TikInteractAccount?.getStatus()))) return;
        preparing = true;
        // Font loading changes word widths; settle those before showing menus.
        Promise.race([document.fonts?.ready, new Promise(resolve => setTimeout(resolve, 1000))])
            .then(() => requestAnimationFrame(() => requestAnimationFrame(() => reveal('ready'))));
    }
    const fallback = setTimeout(() => reveal('fallback'), 8000);
    window.TikInteractStartup = Object.freeze({language, mode, theme, ready(part) { finished.add(part); check(); }});
    window.addEventListener('tikinteract:account-status', check);
    window.addEventListener('pageshow', event => { if (event.persisted) reveal('restored'); });
})();
