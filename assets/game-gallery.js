(() => {
    'use strict';
    const gallery = document.querySelector('.game-gallery');
    const dialog = document.getElementById('game-gallery-dialog');
    if (!gallery || !dialog) return;
    const buttons = [...gallery.querySelectorAll('[data-gallery-image]')];
    const featured = gallery.querySelector('[data-gallery-featured]');
    const expand = gallery.querySelector('[data-gallery-open]');
    const current = gallery.querySelector('[data-gallery-current]');
    const position = gallery.querySelector('[data-gallery-position]');
    const image = dialog.querySelector('[data-gallery-full]');
    const title = dialog.querySelector('[data-gallery-title]');
    const counter = dialog.querySelector('[data-gallery-counter]');
    let index = 0;
    let opener;
    let previousOverflow;
    function show(next) {
        index = (next + buttons.length) % buttons.length;
        const selected = buttons[index];
        image.src = selected.dataset.galleryImage;
        image.alt = selected.querySelector('img').alt;
        title.textContent = selected.dataset.galleryLabel;
        counter.textContent = `${index + 1} / ${buttons.length}`;
        if (featured) {featured.src = selected.dataset.galleryImage; featured.alt = image.alt;}
        if (current) current.textContent = selected.dataset.galleryMode;
        if (position) position.textContent = counter.textContent;
        expand?.setAttribute('aria-label', `Mărește ${selected.dataset.galleryLabel}`);
        buttons.forEach((button,i) => button.setAttribute('aria-pressed', String(i === index)));
    }
    function open() {
        if (typeof dialog.showModal !== 'function') {window.location.href = buttons[index].dataset.galleryImage; return;}
        opener = expand;
        previousOverflow = document.documentElement.style.overflow;
        document.documentElement.style.overflow = 'hidden';
        dialog.showModal();
    }
    buttons.forEach((button, i) => button.addEventListener('click', () => show(i)));
    expand?.addEventListener('click', open);
    gallery.querySelector('.game-gallery-grid').addEventListener('keydown', event => {
        if (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight') return;
        event.preventDefault();
        show(index + (event.key === 'ArrowLeft' ? -1 : 1));
        buttons[index].focus({preventScroll:true});
    });
    show(0);
    dialog.querySelector('[data-gallery-close]').addEventListener('click', () => dialog.close());
    dialog.querySelector('[data-gallery-previous]').addEventListener('click', () => show(index - 1));
    dialog.querySelector('[data-gallery-next]').addEventListener('click', () => show(index + 1));
    dialog.addEventListener('keydown', event => {
        if (event.key === 'Escape') {event.preventDefault(); dialog.close(); return;}
        if (event.key === 'ArrowLeft' || event.key === 'ArrowRight') {
            event.preventDefault();
            show(index + (event.key === 'ArrowLeft' ? -1 : 1));
        }
    });
    dialog.addEventListener('click', event => {if (event.target === dialog) dialog.close();});
    dialog.addEventListener('close', () => {
        document.documentElement.style.overflow = previousOverflow;
        opener?.focus({preventScroll:true});
    });
    let pointerStart;
    image.addEventListener('pointerdown', event => {pointerStart = {x:event.clientX,y:event.clientY};});
    image.addEventListener('pointerup', event => {
        if (!pointerStart) return;
        const dx = event.clientX - pointerStart.x, dy = event.clientY - pointerStart.y;
        if (Math.abs(dx) > 45 && Math.abs(dx) > Math.abs(dy)*1.3) show(index + (dx < 0 ? 1 : -1));
        pointerStart = undefined;
    });
    image.addEventListener('pointercancel', () => {pointerStart = undefined;});
})();
