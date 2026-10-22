// Show the native game at 80% size, shrinking further only for narrow screens.
(() => {
    let nativeWidth = 540, nativeHeight = 960, format = 'portrait', explicitFormat = false;
    try { const saved = localStorage.getItem('tikinteract_studio_format'); if (['portrait','landscape'].includes(saved)) { format = saved; explicitFormat = true; } } catch {}
    function fitGame(viewport) {
        if (viewport && Number.isFinite(viewport.width) && Number.isFinite(viewport.height) && viewport.width >= 240 && viewport.height >= 240 && viewport.width <= 3840 && viewport.height <= 3840) {
            nativeWidth = viewport.width; nativeHeight = viewport.height;
        }
        if (explicitFormat) { nativeWidth = format === 'landscape' ? 960 : 540; nativeHeight = format === 'landscape' ? 540 : 960; }
        const frame = document.getElementById('live-game-frame');
        const wrap = frame?.parentElement;
        if (!frame || !wrap || !wrap.clientWidth || !wrap.clientHeight) return;
        const studioApp = document.body?.classList?.contains('studio-app');
        const desktopApp = studioApp && window.innerWidth >= 1000;
        const available = typeof wrap.getBoundingClientRect === 'function' ? window.innerHeight - wrap.getBoundingClientRect().top - 65 : window.innerHeight - 280;
        const maxScale = desktopApp ? Math.min(.8, Math.max(.15, available / nativeHeight)) : .8;
        // The workspace footer makes the real panel shorter than the remaining
        // window height. Fit both axes inside that panel, including on phones.
        const panelScale = studioApp ? Math.min(Math.max(1, wrap.clientWidth - 2) / nativeWidth, Math.max(1, wrap.clientHeight - 2) / nativeHeight) : Infinity;
        const scale = Math.min(wrap.clientWidth / nativeWidth, maxScale, panelScale);
        wrap.style.setProperty('--studio-preview-height', `${nativeHeight * scale}px`);
        frame.style.setProperty('--game-native-width', `${nativeWidth}px`);
        frame.style.setProperty('--game-native-height', `${nativeHeight}px`);
        frame.style.setProperty('--game-fit-scale', String(scale));
    }
    document.addEventListener('DOMContentLoaded', () => {
        const frame = document.getElementById('live-game-frame'), wrap = frame?.parentElement;
        frame?.addEventListener('load',()=>{publishFormat();fitGame();});
        if (wrap && typeof ResizeObserver !== 'undefined') new ResizeObserver(() => fitGame()).observe(wrap);
        window.addEventListener('resize', () => fitGame());
        window.visualViewport?.addEventListener('resize', () => fitGame());
        fitGame();
    });
    function setFormat(next) {
        if (!['portrait','landscape'].includes(next)) return;
        format = next; explicitFormat = true;
        try { localStorage.setItem('tikinteract_studio_format',format); } catch {}
        fitGame();
        publishFormat();
        window.dispatchEvent(new CustomEvent('tikinteract:format',{detail:{format}}));
    }
    function publishFormat(){const frame=document.getElementById('live-game-frame');if(frame?.dataset?.gameId)frame.contentWindow?.postMessage({type:'tikinteract:format',format},location.origin);}
    window.TikInteractStudioLayout = Object.freeze({fitGame,setFormat,getFormat:()=>format});
})();
