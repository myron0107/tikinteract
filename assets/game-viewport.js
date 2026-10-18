// Embedded previews use a stable viewport; standalone game pages keep their layout.
if (window.parent !== window) {
    const style = document.createElement('style');
    style.textContent = `
        html,body{width:100%;height:100%;margin:0!important;padding:0!important;overflow:hidden!important}
        body{min-height:0!important;display:flex!important;align-items:flex-start!important;justify-content:center!important}
        .workspace{display:block!important;width:100vw!important;min-width:0!important;margin:0!important;padding:0!important;gap:0!important}
        #shell{width:100vw!important;min-width:0!important;max-width:none!important;height:100vh!important;min-height:0!important;max-height:none!important;aspect-ratio:auto!important;margin:0!important;flex-shrink:0!important}
        #scene{min-height:0!important}
    `;
    document.head.append(style);
    requestAnimationFrame(() => window.dispatchEvent(new Event('resize')));
}
