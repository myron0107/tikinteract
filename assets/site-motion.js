(() => {
    'use strict';
    const preference = window.matchMedia('(prefers-reduced-motion: reduce)');
    function initializeMotion() {
        if (preference.matches || typeof IntersectionObserver === 'undefined') return;
        const observer = new IntersectionObserver(entries => {
            for (const entry of entries) {
                if (!entry.isIntersecting) continue;
                entry.target.classList.add('motion-shown');
                observer.unobserve(entry.target);
            }
        }, {threshold: .08});
        const selector = '.home-hot-game, .home-how-step, .home-leaderboard-card, .game-catalog-card, .pricing-card, .account-card, .game-center-card, .public-info-card, .game-page-info-card';
        for (const element of document.querySelectorAll(selector)) {
            const siblings = [...element.parentElement.children].filter(item => item.matches(selector));
            element.style.setProperty('--reveal-delay', `${Math.min(siblings.indexOf(element), 2) * 65}ms`);
            element.classList.add('motion-reveal');
            observer.observe(element);
        }
        preference.addEventListener('change', () => {
            if (!preference.matches) return;
            observer.disconnect();
            document.querySelectorAll('.motion-reveal').forEach(element => element.classList.add('motion-shown'));
        });
    }
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', initializeMotion, {once: true});
    else initializeMotion();
})();
