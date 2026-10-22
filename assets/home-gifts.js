(() => {
    const root = document.querySelector('[data-home-gifts]');
    if (!root) return;
    const $ = selector => root.querySelector(selector);
    const compact=root.hasAttribute('data-home-gifts-compact');
    const t=(ro,en)=>window.TikInteractLanguage?.get()==='en'?en:ro;
    const format = value => new Intl.NumberFormat((window.TikInteractLanguage?.locale() || 'ro-RO')).format(value);
    const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');
    const showcase = $('.home-gifts-showcase');
    const featured = $('[data-gifts-featured]');
    const play = $('[data-gifts-play]');
    let gifts = [], picks = [], selected = 0, ready = false, loading = null;
    let paused = reducedMotion.matches, visible = false, hovered = false, focused = false, timer = null;
    let dialog, search, grid, count, more, empty, results = [], limit = 48;
    let lastFocus, previousOverflow = '';

    function node(tag, className, text) {
        const element = document.createElement(tag);
        if (className) element.className = className;
        if (text != null) element.textContent = text;
        return element;
    }
    function icon(name) {
        const element = node('i', 'fa-solid fa-' + name);
        element.setAttribute('aria-hidden', 'true');
        return element;
    }
    function image(gift, lazy = false) {
        const element = node('img');
        element.src = gift.file;
        element.alt = '';
        element.width = 174;
        element.height = 174;
        element.decoding = 'async';
        if (lazy) element.loading = 'lazy';
        return element;
    }
    function price(gift, full = false) {
        const element = node('span', 'home-gifts-price');
        element.append(icon('coins'), node('b', '', format(gift.coins)));
        if (full) element.append(document.createTextNode(gift.coins === 1 ? t(' monedă TikTok',' TikTok coin') : t(' monede TikTok',' TikTok coins')));
        else element.setAttribute('aria-label', format(gift.coins) + (gift.coins === 1 ? t(' monedă TikTok',' TikTok coin') : t(' monede TikTok',' TikTok coins')));
        return element;
    }
    function updatePlayback() {
        if(compact)return;
        const running = ready && !paused && visible && !document.hidden && !hovered && !focused && !dialog?.open;
        if(!running&&timer){clearInterval(timer);timer=null;}
        showcase.classList.toggle('is-running', running);
        play.setAttribute('aria-label', paused ? t('Pornește prezentarea cadourilor','Play gift showcase') : t('Pauză prezentare cadouri','Pause gift showcase'));
        play.setAttribute('aria-pressed', String(paused));
        play.replaceChildren(icon(paused ? 'play' : 'pause'));
        if (running&&!timer) timer = setInterval(() => select(selected + 1), 4000);
    }
    function select(index, manual = false) {
        if(compact)return;
        if (!ready) return;
        selected = (index + picks.length) % picks.length;
        const gift = picks[selected];
        featured.classList.remove('is-entering');
        featured.replaceChildren(image(gift), node('h3', '', gift.name), price(gift, true));
        // Re-enter once per gift; no animation frame loop is needed.
        void featured.offsetWidth;
        featured.classList.add('is-entering');
        $('[data-gifts-position]').textContent = String(selected + 1).padStart(2, '0') + ' / ' + String(picks.length).padStart(2, '0');
        $('[data-gifts-picks]').querySelectorAll('button').forEach((button, i) => button.setAttribute('aria-pressed', String(i === selected)));
        if (manual) {
            paused = true;
            $('[data-gifts-status]').textContent = gift.name + ', ' + format(gift.coins) + t(' monede TikTok',' TikTok coins');
        }
        updatePlayback();
    }
    async function load() {
        if (ready) return;
        if (loading) return loading;
        $('[data-gifts-retry]').hidden = true;
        $('[data-gifts-status]').textContent = t('Se pregătește prezentarea…','Loading gifts…');
        loading = (async () => {
            const response = await fetch('assets/tiktok-gifts-catalog.json');
            if (!response.ok) throw new Error('Catalog indisponibil');
            const snapshot = await response.json();
            gifts = snapshot.gifts.filter(gift => /^assets\/tiktok-gift-images\/[a-f0-9]{64}\.(webp|png|jpg)$/.test(snapshot.imageFiles?.[gift.id] || ''))
                .map(gift => ({...gift, file: snapshot.imageFiles[gift.id]}));
            const ids = ['5655', '5487', '5879', '7168', '11046', '9101'];
            picks = ids.map(id => gifts.find(gift => gift.id === id)).filter(Boolean);
            if (!picks.length) throw new Error('Catalog gol');
            const choices = $('[data-gifts-picks]');
            choices.replaceChildren(...picks.map((gift, index) => {
                const button = node(compact?'article':'button', 'home-gifts-pick');
                button.title = gift.name;
                if(!compact){button.type = 'button';button.setAttribute('aria-label', t('Prezintă ','Show ') + gift.name);}
                button.append(image(gift), node(compact?'h3':'span', '', gift.name));
                if(compact)button.append(price(gift));
                if(!compact)button.addEventListener('click', () => select(index, true));
                return button;
            }));
            ready = true;
            // Keep announcements available for manual selection without visible duplicate text.
            $('[data-gifts-status]').classList.add('sr-only');
            $('[data-gifts-status]').classList.remove('home-gifts-loading');
            $('[data-gifts-status]').textContent = '';
            $('[data-gifts-note]').textContent = format(gifts.length) + t(' cadouri de explorat · Colecție pentru fiecare streamer',' gifts to explore · A collection for every streamer');
            root.querySelectorAll('[disabled]').forEach(button => button.disabled = false);
            select(0);
        })().catch(() => {
            $('[data-gifts-status]').classList.remove('sr-only');
            $('[data-gifts-status]').textContent = t('Catalogul nu s-a putut încărca.','The catalog could not be loaded.');
            $('[data-gifts-retry]').hidden = false;
        }).finally(() => { loading = null; });
        return loading;
    }
    function renderCatalog(reset = false) {
        if (reset) {
            limit = 48;
            const query = search.value.trim().toLocaleLowerCase((window.TikInteractLanguage?.locale() || 'ro-RO'));
            results = gifts.filter(gift => gift.name.toLocaleLowerCase((window.TikInteractLanguage?.locale() || 'ro-RO')).includes(query) || gift.id.includes(query));
        }
        grid.replaceChildren(...results.slice(0, limit).map(gift => {
            const card = node('article', 'home-gift-catalog-card');
            card.append(image(gift, true), node('h3', '', gift.name), price(gift));
            return card;
        }));
        count.textContent = format(results.length) + t(' cadouri',' gifts') + (results.length ? ' · ' + format(Math.min(limit, results.length)) + t(' afișate',' shown') : t(' găsite',' found'));
        empty.hidden = !!results.length;
        more.hidden = limit >= results.length;
        more.textContent = t('Arată mai multe (','Show more (') + format(Math.max(0, results.length - limit)) + ')';
    }
    function catalogLabels(){
        if(!dialog)return;
        dialog.querySelector('h2').textContent=t('Catalogul de cadouri','Gift catalog');
        dialog.querySelector('.home-gift-catalog-close').setAttribute('aria-label',t('Închide catalogul','Close catalog'));
        search.placeholder=t('Caută un cadou…','Search gifts…');
        search.setAttribute('aria-label',t('Caută un cadou după nume sau ID','Search gifts by name or ID'));
        empty.textContent=t('Niciun cadou găsit. Încearcă alt nume.','No gifts found. Try another name.');
        dialog.querySelector('.home-gift-catalog-footer').textContent=t('Cadourile primite la LIVE se adună în colecția ta.','Gifts received during LIVE are added to your collection.');
    }
    function createCatalog() {
        dialog = node('dialog', 'home-gift-catalog');
        dialog.setAttribute('aria-labelledby', 'home-gift-catalog-title');
        dialog.setAttribute('data-native-i18n','');
        dialog.innerHTML = '<div class="home-gift-catalog-header"><div class="home-gift-catalog-heading"><div><span class="eyebrow">TIKTOK GIFTS</span><h2 id="home-gift-catalog-title">Catalogul de cadouri</h2></div><button type="button" class="home-gift-catalog-close" aria-label="Închide catalogul"><i class="fa-solid fa-xmark" aria-hidden="true"></i></button></div><label class="home-gift-catalog-search"><i class="fa-solid fa-magnifying-glass" aria-hidden="true"></i><input type="search" placeholder="Caută un cadou…" aria-label="Caută un cadou după nume sau ID"></label><p class="home-gift-catalog-count" role="status"></p></div><div class="home-gift-catalog-grid"></div><p class="home-gift-catalog-empty" hidden>Niciun cadou găsit. Încearcă alt nume.</p><button class="home-gift-catalog-more" type="button">Arată mai multe</button><p class="home-gift-catalog-footer">Cadourile primite la LIVE se adună în colecția ta.</p>';
        const scroll=node('div','home-gift-catalog-scroll');scroll.append(...dialog.childNodes);dialog.append(scroll);
        document.body.append(dialog);
        search = dialog.querySelector('input');
        grid = dialog.querySelector('.home-gift-catalog-grid');
        count = dialog.querySelector('.home-gift-catalog-count');
        more = dialog.querySelector('.home-gift-catalog-more');
        empty = dialog.querySelector('.home-gift-catalog-empty');
        catalogLabels();
        search.addEventListener('input', () => renderCatalog(true));
        more.addEventListener('click', () => {
            const nextIndex = Math.min(limit, results.length);
            limit += 48;
            renderCatalog();
            // Keep the newly revealed gifts in view, even when the last page hides the button.
            const next = grid.children[nextIndex];
            if (next) { next.tabIndex = -1; next.focus({preventScroll: true}); next.scrollIntoView({block: 'nearest'}); }
        });
        dialog.querySelector('.home-gift-catalog-close').addEventListener('click', () => dialog.close());
        dialog.addEventListener('click', event => {
            if (event.target !== dialog) return;
            const rect = dialog.getBoundingClientRect();
            if (event.clientX < rect.left || event.clientX > rect.right || event.clientY < rect.top || event.clientY > rect.bottom) dialog.close();
        });
        dialog.addEventListener('close', () => {
            document.body.style.overflow = previousOverflow;
            lastFocus?.focus({preventScroll: true});
            updatePlayback();
        });
    }
    $('[data-gifts-browse]').addEventListener('click', () => {
        if (!ready) return;
        if (!dialog) createCatalog();
        search.value = '';
        renderCatalog(true);
        lastFocus = $('[data-gifts-browse]');
        previousOverflow = document.body.style.overflow;
        document.body.style.overflow = 'hidden';
        dialog.showModal();
        dialog.querySelector('.home-gift-catalog-scroll').scrollTop = 0;
        dialog.querySelector('.home-gift-catalog-close')?.focus({preventScroll: true});
        updatePlayback();
    });
    if(!compact){
    play.addEventListener('click', () => {
        paused = !paused;
        // An explicit Play also works while the control has pointer or keyboard focus.
        if (!paused) { hovered = false; focused = false; }
        updatePlayback();
    });
    $('[data-gifts-prev]').addEventListener('click', () => select(selected - 1, true));
    $('[data-gifts-next]').addEventListener('click', () => select(selected + 1, true));
    showcase.addEventListener('pointerenter', event => { if (event.pointerType !== 'touch') { hovered = true; updatePlayback(); } });
    showcase.addEventListener('pointerleave', () => { hovered = false; updatePlayback(); });
    showcase.addEventListener('focusin', () => { focused = document.activeElement.matches(':focus-visible'); updatePlayback(); });
    showcase.addEventListener('focusout', () => { queueMicrotask(() => { focused = showcase.contains(document.activeElement) && document.activeElement.matches(':focus-visible'); updatePlayback(); }); });
    document.addEventListener('visibilitychange', updatePlayback);
    reducedMotion.addEventListener('change', event => { paused = event.matches; updatePlayback(); });
    new IntersectionObserver(entries => {
        visible = entries[0].isIntersecting;
        updatePlayback();
    }, {threshold: .2}).observe(showcase);
    }
    $('[data-gifts-retry]').onclick=load;
    function showcaseLabels(){
        $('[data-gifts-prev]')?.setAttribute('aria-label',t('Cadoul anterior','Previous gift'));
        $('[data-gifts-next]')?.setAttribute('aria-label',t('Cadoul următor','Next gift'));
        $('[data-gifts-picks]').querySelectorAll('button').forEach((button,i)=>button.setAttribute('aria-label',t('Prezintă ','Show ')+picks[i].name));
        if(ready){$('[data-gifts-note]').textContent=format(gifts.length)+t(' cadouri de explorat · Colecție pentru fiecare streamer',' gifts to explore · A collection for every streamer');if(!compact){const priceNode=featured.querySelector('.home-gifts-price');if(priceNode)priceNode.replaceWith(price(picks[selected],true));}}
        updatePlayback();
    }
    showcaseLabels();
    window.addEventListener('tikinteract:language',()=>{showcaseLabels();if(dialog){catalogLabels();renderCatalog();}});
    const loader = new IntersectionObserver(entries => {
        if (!entries[0].isIntersecting) return;
        loader.disconnect();
        load();
    }, {rootMargin: '300px'});
    loader.observe(root);
})();
