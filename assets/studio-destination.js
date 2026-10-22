// Resume a public ticket choice only after the authenticated Studio is ready.
export function initializeStudioDestination(open, browser=window) {
    if (browser.document.body.dataset.page !== 'studio') return;
    const route = new URLSearchParams(browser.location.search);
    if (route.get('section') !== 'subscription') return;
    const plan = ['free','play_pass','play_pass_pro'].includes(route.get('plan')) ? route.get('plan') : '';
    let consumed = false;
    const events = ['tikinteract:auth','tikinteract:account-status','tikinteract:ui-ready'];
    const resume = () => {
        if (consumed || !browser.tikInteractUser || !browser.TikInteractAccount?.isAllowed()
            || !browser.TikInteractStudioWindows || browser.document.documentElement.dataset.uiPending !== undefined) return;
        consumed = true;
        for (const event of events) browser.removeEventListener(event, schedule);
        open('subscription', plan);
    };
    // Auth listeners also close stale account windows. Resume after they settle.
    const schedule = () => browser.queueMicrotask(resume);
    for (const event of events) browser.addEventListener(event, schedule);
    schedule();
}
