// Show the native game at 80% size, shrinking further only for narrow screens.
(() => {
    let nativeWidth = 540, nativeHeight = 960;
    function fitGame(viewport) {
        if (viewport && Number.isFinite(viewport.width) && Number.isFinite(viewport.height) && viewport.width >= 240 && viewport.height >= 240 && viewport.width <= 3840 && viewport.height <= 3840) {
            nativeWidth = viewport.width; nativeHeight = viewport.height;
        }
        const frame = document.getElementById('live-game-frame');
        const wrap = frame?.parentElement;
        if (!frame || !wrap || !wrap.clientWidth || !wrap.clientHeight) return;
        const desktopApp = document.body?.classList?.contains('studio-app') && window.innerWidth >= 1000;
        const maxScale = desktopApp ? Math.min(.8, Math.max(.25, (window.innerHeight - 280) / nativeHeight)) : .8;
        const scale = Math.min(wrap.clientWidth / nativeWidth, maxScale);
        wrap.style.setProperty('--studio-preview-height', `${nativeHeight * scale}px`);
        frame.style.setProperty('--game-native-width', `${nativeWidth}px`);
        frame.style.setProperty('--game-native-height', `${nativeHeight}px`);
        frame.style.setProperty('--game-fit-scale', String(scale));
    }
    document.addEventListener('DOMContentLoaded', () => {
        const wrap = document.getElementById('live-game-frame')?.parentElement;
        if (wrap && typeof ResizeObserver !== 'undefined') new ResizeObserver(() => fitGame()).observe(wrap);
        window.addEventListener('resize', () => fitGame());
        window.visualViewport?.addEventListener('resize', () => fitGame());
        fitGame();
    });
    window.TikInteractStudioLayout = Object.freeze({fitGame});
})();
