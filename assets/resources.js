(() => {
    const config = {discordUrl: '', supportEmail: 'mironsergiuflorin@gmail.com'};
    const host = document.querySelector('[data-footer-resources]') || document.querySelector('.template-navigation, .public-info-site-header, .app-topbar-title');
    if (!host) return;
    const robot = `<svg class="resource-bot" viewBox="0 0 120 122" aria-hidden="true"><g class="resource-bot-float"><path d="M60 24V12" stroke="#db8498" stroke-width="3"/><circle class="resource-bot-light" cx="60" cy="9" r="5" fill="#ec526e"/><rect x="17" y="40" width="10" height="23" rx="5" fill="#742039"/><rect x="93" y="40" width="10" height="23" rx="5" fill="#742039"/><rect x="25" y="24" width="70" height="54" rx="20" fill="#29242e" stroke="#925064" stroke-width="1.5"/><rect x="31" y="31" width="58" height="37" rx="13" fill="#eeecf1"/><g class="resource-bot-eyes" fill="#6d2038"><rect x="43" y="41" width="7" height="12" rx="3.5"/><rect x="70" y="41" width="7" height="12" rx="3.5"/></g><path d="M54 58q6 5 12 0" fill="none" stroke="#8b3b52" stroke-width="2" stroke-linecap="round"/><rect x="39" y="82" width="42" height="26" rx="11" fill="#9f2945"/><path d="m61 86-7 10h7l-2 8 9-12h-7z" fill="#f8e4eb"/><path d="M39 89 28 100" stroke="#9f2945" stroke-width="10" stroke-linecap="round"/><g class="resource-bot-arm"><path d="m81 89 15-13 4-14" fill="none" stroke="#9f2945" stroke-width="10" stroke-linecap="round"/><circle cx="101" cy="59" r="7" fill="#dfd9e3"/></g><path d="M49 109v5m22-5v5" stroke="#dfd9e3" stroke-width="9" stroke-linecap="round"/></g></svg>`;
    const nav = document.createElement('div');
    nav.className = 'resources-nav';
    nav.hidden = document.body.dataset.page === 'studio';
    nav.innerHTML = `<button class="resources-trigger" type="button" aria-expanded="false" aria-controls="resources-menu"><i class="fa-solid fa-layer-group" aria-hidden="true"></i><span>RESURSE</span><i class="fa-solid fa-chevron-down resources-chevron" aria-hidden="true"></i></button>
        <div id="resources-menu" class="resources-menu" hidden>
            <div class="resources-links">
                <a href="guide.html" aria-haspopup="dialog" aria-controls="resource-page-dialog"><span class="resource-icon"><i class="fa-solid fa-book-open" aria-hidden="true"></i></span><span><strong>GHIDURI</strong><small>Configurare, jocuri și primii pași.</small></span><i class="fa-solid fa-arrow-right" aria-hidden="true"></i></a>
                <a href="updates.html" aria-haspopup="dialog" aria-controls="resource-page-dialog"><span class="resource-icon"><i class="fa-solid fa-bolt" aria-hidden="true"></i></span><span><strong>NOUTĂȚI</strong><small>Ce am adăugat și îmbunătățit.</small></span><i class="fa-solid fa-arrow-right" aria-hidden="true"></i></a>
                <a href="about.html" aria-haspopup="dialog" aria-controls="resource-page-dialog"><span class="resource-icon"><i class="fa-solid fa-heart" aria-hidden="true"></i></span><span><strong>DESPRE NOI</strong><small>Jocuri construite pentru LIVE.</small></span><i class="fa-solid fa-arrow-right" aria-hidden="true"></i></a>
                <button type="button" data-open-support><span class="resource-icon"><i class="fa-solid fa-comment-dots" aria-hidden="true"></i></span><span><strong>SUPORT</strong><small>O idee, o problemă sau o întrebare.</small></span><i class="fa-solid fa-arrow-right" aria-hidden="true"></i></button>
                <a href="privacy-policy.html" aria-haspopup="dialog" aria-controls="resource-page-dialog"><span class="resource-icon"><i class="fa-solid fa-shield-halved" aria-hidden="true"></i></span><span><strong>CONFIDENȚIALITATE</strong><small>Cum sunt folosite datele tale.</small></span><i class="fa-solid fa-arrow-right" aria-hidden="true"></i></a>
                <a href="terms-of-use.html" aria-haspopup="dialog" aria-controls="resource-page-dialog"><span class="resource-icon"><i class="fa-solid fa-file-lines" aria-hidden="true"></i></span><span><strong>TERMENI DE UTILIZARE</strong><small>Regulile platformei.</small></span><i class="fa-solid fa-arrow-right" aria-hidden="true"></i></a>
            </div>
            <div class="resources-community"><span class="resource-discord-mark"><i class="fa-brands fa-discord" aria-hidden="true"></i></span><span><strong>Ne vedem și pe Discord.</strong><small>Pregătim un loc pentru comunitate.</small></span><button type="button" data-resources-discord aria-disabled="true">În curând</button></div>
        </div>`;
    host.append(nav);
    const trigger = nav.querySelector('.resources-trigger'), menu = nav.querySelector('.resources-menu');
    function positionMenu() {
        const header=host.closest('header');
        if(header)menu.style.setProperty('--resources-top', Math.round(header.getBoundingClientRect().bottom + 8) + 'px');
        else menu.style.setProperty('--resources-bottom',Math.max(18,innerHeight-host.getBoundingClientRect().top+12)+'px');
    }
    function closeMenu(restore = false) {
        menu.hidden = true; trigger.setAttribute('aria-expanded', 'false');
        if (restore) trigger.focus();
    }
    trigger.addEventListener('click', () => {
        const open = menu.hidden;
        menu.hidden = !open; trigger.setAttribute('aria-expanded', String(open));
        if (open) positionMenu();
    });
    document.addEventListener('click', event => {if (!nav.contains(event.target)) closeMenu();});
    document.addEventListener('keydown', event => {if (event.key === 'Escape' && !menu.hidden) {event.preventDefault(); closeMenu(true);}});
    // During pointer focus changes, activeElement can briefly be body. Use the
    // actual destination so the menu survives until the link/button receives click.
    nav.addEventListener('focusout', event => {
        if (event.relatedTarget && !nav.contains(event.relatedTarget)) closeMenu();
    });
    addEventListener('resize', () => {if (!menu.hidden) positionMenu();});
    if (/^https:\/\/(?:discord\.gg\/|discord\.com\/invite\/)/.test(config.discordUrl)) {
        const old = nav.querySelector('[data-resources-discord]'), link = document.createElement('a');
        link.href = config.discordUrl; link.target = '_blank'; link.rel = 'noopener noreferrer';
        link.textContent = 'Intră pe Discord'; old.replaceWith(link);
        nav.querySelector('.resources-community small').textContent = 'Idei, ajutor și discuții între creatori.';
    }

    // Render the existing public content in one centered dialog. The source pages
    // remain the single place to edit copy, and ordinary links still work without JS.
    const resourcePages = new Map([
        ['/guide.html','Ghiduri'], ['/updates.html','Noutăți'], ['/about.html','Despre noi'],
        ['/privacy-policy.html','Confidențialitate'], ['/terms-of-use.html','Termeni de utilizare']
    ]);
    const pageDialog = document.createElement('dialog');
    pageDialog.id = 'resource-page-dialog'; pageDialog.className = 'resource-page-dialog';
    pageDialog.setAttribute('aria-labelledby','resource-page-title');
    pageDialog.innerHTML = `<div class="resource-page-topbar"><span class="resource-page-label"><i class="fa-solid fa-layer-group" aria-hidden="true"></i> RESURSE <span aria-hidden="true">/</span> <strong id="resource-page-title"></strong></span><button class="support-icon-button" type="button" data-resource-close aria-label="Închide pagina" autofocus><i class="fa-solid fa-xmark" aria-hidden="true"></i></button></div><div class="resource-reader" tabindex="-1"></div>`;
    document.body.append(pageDialog);
    const reader = pageDialog.querySelector('.resource-reader'), pageTitle = pageDialog.querySelector('#resource-page-title');
    const pageCache = new Map();
    let pagePreviousFocus, pageRequest = 0, pageAbort, currentPage;
    function outsideDialog(event, target) {
        const box = target.getBoundingClientRect();
        return event.target === target && (event.clientX < box.left || event.clientX > box.right || event.clientY < box.top || event.clientY > box.bottom);
    }
    function renderPage(source) {
        const main = source.cloneNode(true), ids = new Map();
        main.querySelector('.public-info-back')?.remove();
        main.querySelectorAll('script,style,link,iframe').forEach(node => node.remove());
        for (const element of main.querySelectorAll('[id]')) {
            ids.set(element.id,'resource-view-'+element.id); element.id = ids.get(element.id);
        }
        for (const link of main.querySelectorAll('a[href^="#"]')) {
            const target = ids.get(link.getAttribute('href').slice(1));
            if (target) link.setAttribute('href','#'+target);
        }
        reader.replaceChildren(main); reader.scrollTop = 0;
        reader.setAttribute('aria-busy','false'); pageDialog.dataset.state = 'ready';
    }
    async function openResource(path) {
        if (!resourcePages.has(path)) return;
        const request = ++pageRequest; pageAbort?.abort(); pageAbort = new AbortController(); currentPage = path;
        if (!pageDialog.open) {
            pagePreviousFocus = nav.contains(document.activeElement) ? trigger : document.activeElement;
            closeMenu(); pageDialog.showModal();
        }
        pageTitle.textContent = resourcePages.get(path); pageDialog.dataset.page = path;
        if (pageCache.has(path)) {renderPage(pageCache.get(path)); return;}
        reader.setAttribute('aria-busy','true'); pageDialog.dataset.state = 'loading';
        const loading = document.createElement('p'); loading.className = 'resource-loading'; loading.setAttribute('role','status'); loading.textContent = 'Se încarcă…';
        reader.replaceChildren(loading);
        try {
            const response = await fetch(path,{signal:pageAbort.signal});
            if (!response.ok) throw Error('Resource unavailable');
            const document = new DOMParser().parseFromString(await response.text(),'text/html');
            const main = document.querySelector('main.public-info-page');
            if (!main) throw Error('Missing resource content');
            if (request !== pageRequest || !pageDialog.open) return;
            pageCache.set(path,main); renderPage(main);
        } catch (error) {
            if (request !== pageRequest || error.name === 'AbortError' || !pageDialog.open) return;
            reader.setAttribute('aria-busy','false'); pageDialog.dataset.state = 'error';
            reader.innerHTML = `<div class="resource-load-error" role="status"><i class="fa-solid fa-arrow-rotate-right" aria-hidden="true"></i><h2>Pagina nu s-a încărcat.</h2><p>Verifică legătura la internet și încearcă din nou.</p><button type="button" data-resource-retry>Încearcă din nou</button></div>`;
        }
    }
    pageDialog.querySelector('[data-resource-close]').addEventListener('click', () => pageDialog.close());
    pageDialog.addEventListener('close', () => {
        if (pageDialog.open) return; // A queued close must not cancel a newer opening.
        pageRequest++; pageAbort?.abort();
        if (pagePreviousFocus?.isConnected) pagePreviousFocus.focus({preventScroll:true});
    });
    pageDialog.addEventListener('click', event => {
        if (outsideDialog(event,pageDialog)) pageDialog.close();
        if (event.target.closest('[data-resource-retry]')) openResource(currentPage);
        const anchor = event.target.closest('a[href^="#resource-view-"]');
        if (anchor) {
            const target = reader.querySelector('[id="'+anchor.getAttribute('href').slice(1)+'"]');
            if (target) {event.preventDefault(); target.scrollIntoView({block:'start',behavior:'instant'});}
        }
    });
    document.addEventListener('click', event => {
        const link = event.target.closest('a[href]');
        if (!link || event.defaultPrevented || event.button !== 0 || event.ctrlKey || event.metaKey || event.shiftKey || event.altKey || link.target === '_blank' || link.hasAttribute('download')) return;
        const url = new URL(link.href,location.href);
        if (url.origin === location.origin && resourcePages.has(url.pathname) && !url.hash && !url.search) {
            event.preventDefault(); openResource(url.pathname);
        }
    });

    const topics = {
        game: {title:'Propune un joc', description:'Ce ți-ar plăcea să joci cu publicul tău?', icon:'fa-gamepad', hint:'Descrie jocul, cum intervin spectatorii și cum se câștigă o rundă.'},
        bug: {title:'Raportează o problemă', description:'Ceva nu funcționează cum ar trebui?', icon:'fa-bug', hint:'Ce s-a întâmplat? Ce te așteptai să se întâmple? Spune-ne pașii prin care putem reproduce problema.'},
        idea: {title:'Sugerează o îmbunătățire', description:'O schimbare care ți-ar face LIVE-ul mai bun.', icon:'fa-wand-magic-sparkles', hint:'Ce ai schimba sau adăuga? Cum te-ar ajuta în timpul LIVE-ului?'},
        question: {title:'Întreabă-ne orice', description:'Suntem aici și pentru întrebările mici.', icon:'fa-comment-dots', hint:'Scrie întrebarea ta și câteva detalii care ne-ar putea ajuta.'}
    };
    const dialog = document.createElement('dialog');
    dialog.id = 'site-support'; dialog.className = 'resource-support';
    dialog.setAttribute('aria-labelledby','resource-support-title');
    dialog.innerHTML = `<div class="support-topbar"><a class="support-brand" href="index.html"><span class="ti-wordmark ti-brand-lockup" translate="no"><span class="ti-symbol" aria-hidden="true"></span><span class="ti-brand-name">Tik<span>Interact.</span></span></span></a><button type="button" class="support-icon-button" data-support-close aria-label="Închide suportul" autofocus><i class="fa-solid fa-xmark" aria-hidden="true"></i></button></div><div class="support-content"></div>`;
    document.body.append(dialog);
    if(!document.querySelector('link[href*="assets/support-center.css"]')){const styles=document.createElement('link');styles.rel='stylesheet';styles.href='assets/support-center.css?v=2';document.head.append(styles);}
    let support, previousFocus;
    const ready=import('./support-widget.js?v=2').then(({mountSupport})=>support=mountSupport({dialog,topics,robot,onOpen(){
        previousFocus=nav.contains(document.activeElement)?trigger:document.activeElement;closeMenu();
    }}));
    document.addEventListener('click', async event => {
        const button=event.target.closest('[data-open-support]');if(!button)return;
        try{await ready;await support.open({inbox:button.dataset.openSupport==='inbox'});}catch{location.href='mailto:'+config.supportEmail;}
    });
    dialog.querySelector('[data-support-close]').addEventListener('click',()=>dialog.close());
    dialog.addEventListener('close',()=>{if(!dialog.open&&previousFocus?.isConnected)previousFocus.focus({preventScroll:true});});
    dialog.addEventListener('click',event=>{if(outsideDialog(event,dialog))dialog.close();});
    let supportBadgeRequest=0;
    async function refreshSupportBadge(){
        const request=++supportBadgeRequest,userId=window.tikInteractUser?.id,client=window.tikInteractSupabase;
        if(!userId||!client||document.hidden)return;
        try{
            const {data,error}=await client.rpc('list_support_tickets',{p_filter:'unread',p_search:'',p_limit:1,p_offset:0});
            if(error||request!==supportBadgeRequest||userId!==window.tikInteractUser?.id)return;
            const badge=document.querySelector('[data-support-unread]');if(badge){badge.textContent=data.stats.unread;badge.hidden=!data.stats.unread;}
        }catch{}
    }
    function accountMessages(){
        if(window.TikInteractCreator){window.TikInteractCreator.refreshMenu();return;}
        supportBadgeRequest++;
        document.querySelectorAll('[data-account-support]').forEach(node=>node.remove());
        const profile=document.getElementById('user-profile-menu');
        if(!profile||!window.tikInteractUser)return;
        const button=document.createElement('button');button.type='button';button.className='account-menu-button';button.dataset.accountSupport='';button.dataset.openSupport='inbox';
        button.innerHTML='<i class="fa-regular fa-comments" aria-hidden="true"></i> MESAJELE MELE <span class="support-account-unread" data-support-unread hidden></span>';const account=profile.querySelector('[data-account-home]');if(account)account.after(button);else profile.prepend(button);refreshSupportBadge();
    }
    window.addEventListener('tikinteract:auth',accountMessages);accountMessages();
    window.addEventListener('tikinteract:support',refreshSupportBadge);
    setInterval(refreshSupportBadge,45000);
    const footer = document.querySelector('.footer-links, .public-info-footer');
    if (footer && !document.querySelector('[data-footer-resources]')) {
        const link = document.createElement('button'); link.type = 'button'; link.textContent = 'Suport'; link.dataset.openSupport = ''; footer.append(link);
    }
})();
