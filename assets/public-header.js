// Shared behaviour for the same statically-rendered public header on every page.
(() => {
    function initialize() {
        const header = document.querySelector('.ti-site-header');
        if (!header) return;
        const home = new URL(header.querySelector('.template-brand').getAttribute('href'), location.href);
        if (typeof window.switchView !== 'function') window.switchView = view => {
            const url = new URL(home); url.searchParams.set('view', view); location.assign(url);
        };
        if (typeof window.checkAccessAndGo !== 'function') window.checkAccessAndGo = () => {
            const url = new URL(home); url.searchParams.set('view', 'live'); location.assign(url);
        };
        let queued = false, scrolled;
        const update = () => {
            queued = false;
            const next = scrollY > 24;
            if (next !== scrolled) { scrolled = next; header.classList.toggle('is-scrolled', next); }
        };
        const schedule = () => { if (!queued) { queued = true; requestAnimationFrame(update); } };
        update();
        window.addEventListener('scroll', schedule, {passive: true});
        window.addEventListener('pageshow', schedule);
        window.addEventListener('tikinteract:view', schedule);
        if (document.body.id !== 'tikinteract-site') window.TikInteractStartup?.ready('layout');
    }
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', initialize, {once: true});
    else initialize();
})();
