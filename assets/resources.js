// Shared public resources and support. Set the invite when Discord is ready.
(() => {
    const config = {discordUrl: '', supportEmail: 'mironsergiuflorin@gmail.com'};
    const host = document.querySelector('.template-navigation, .public-info-site-header');
    if (!host) return;
    const robot = `<svg class="resource-bot" viewBox="0 0 120 122" aria-hidden="true"><g class="resource-bot-float"><path d="M60 24V12" stroke="#db8498" stroke-width="3"/><circle class="resource-bot-light" cx="60" cy="9" r="5" fill="#ec526e"/><rect x="17" y="40" width="10" height="23" rx="5" fill="#742039"/><rect x="93" y="40" width="10" height="23" rx="5" fill="#742039"/><rect x="25" y="24" width="70" height="54" rx="20" fill="#29242e" stroke="#925064" stroke-width="1.5"/><rect x="31" y="31" width="58" height="37" rx="13" fill="#eeecf1"/><g class="resource-bot-eyes" fill="#6d2038"><rect x="43" y="41" width="7" height="12" rx="3.5"/><rect x="70" y="41" width="7" height="12" rx="3.5"/></g><path d="M54 58q6 5 12 0" fill="none" stroke="#8b3b52" stroke-width="2" stroke-linecap="round"/><rect x="39" y="82" width="42" height="26" rx="11" fill="#9f2945"/><path d="m61 86-7 10h7l-2 8 9-12h-7z" fill="#f8e4eb"/><path d="M39 89 28 100" stroke="#9f2945" stroke-width="10" stroke-linecap="round"/><g class="resource-bot-arm"><path d="m81 89 15-13 4-14" fill="none" stroke="#9f2945" stroke-width="10" stroke-linecap="round"/><circle cx="101" cy="59" r="7" fill="#dfd9e3"/></g><path d="M49 109v5m22-5v5" stroke="#dfd9e3" stroke-width="9" stroke-linecap="round"/></g></svg>`;
    const nav = document.createElement('div');
    nav.className = 'resources-nav';
    nav.innerHTML = `<button class="resources-trigger" type="button" aria-expanded="false" aria-controls="resources-menu"><i class="fa-solid fa-layer-group" aria-hidden="true"></i><span>RESURSE</span><i class="fa-solid fa-chevron-down resources-chevron" aria-hidden="true"></i></button>
        <div id="resources-menu" class="resources-menu" hidden>
            <div class="resources-links">
                <a href="guide.html"><span class="resource-icon"><i class="fa-solid fa-book-open" aria-hidden="true"></i></span><span><strong>GHIDURI</strong><small>Configurare, jocuri și primii pași.</small></span><i class="fa-solid fa-arrow-up-right-from-square" aria-hidden="true"></i></a>
                <a href="updates.html"><span class="resource-icon"><i class="fa-solid fa-bolt" aria-hidden="true"></i></span><span><strong>NOUTĂȚI</strong><small>Ce am adăugat și îmbunătățit.</small></span><i class="fa-solid fa-arrow-up-right-from-square" aria-hidden="true"></i></a>
                <a href="about.html"><span class="resource-icon"><i class="fa-solid fa-heart" aria-hidden="true"></i></span><span><strong>DESPRE NOI</strong><small>Jocuri construite pentru LIVE.</small></span><i class="fa-solid fa-arrow-up-right-from-square" aria-hidden="true"></i></a>
                <button type="button" data-open-support><span class="resource-icon"><i class="fa-solid fa-comment-dots" aria-hidden="true"></i></span><span><strong>SUPORT</strong><small>O idee, o problemă sau o întrebare.</small></span><i class="fa-solid fa-arrow-right" aria-hidden="true"></i></button>
            </div>
            <div class="resources-community"><span class="resource-discord-mark"><i class="fa-brands fa-discord" aria-hidden="true"></i></span><span><strong>Ne vedem și pe Discord.</strong><small>Pregătim un loc pentru comunitate.</small></span><button type="button" data-resources-discord aria-disabled="true">În curând</button></div>
        </div>`;
    host.append(nav);
    const trigger = nav.querySelector('.resources-trigger'), menu = nav.querySelector('.resources-menu');
    function positionMenu() {
        menu.style.setProperty('--resources-top', Math.round(host.closest('header').getBoundingClientRect().bottom + 8) + 'px');
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
    nav.addEventListener('focusout', () => {queueMicrotask(() => {if (!nav.contains(document.activeElement)) closeMenu();});});
    addEventListener('resize', () => {if (!menu.hidden) positionMenu();});
    menu.addEventListener('click', event => {if (event.target.closest('a')) closeMenu();});
    if (/^https:\/\/(?:discord\.gg\/|discord\.com\/invite\/)/.test(config.discordUrl)) {
        const old = nav.querySelector('[data-resources-discord]'), link = document.createElement('a');
        link.href = config.discordUrl; link.target = '_blank'; link.rel = 'noopener noreferrer';
        link.textContent = 'Intră pe Discord'; old.replaceWith(link);
        nav.querySelector('.resources-community small').textContent = 'Idei, ajutor și discuții între creatori.';
    }

    const topics = {
        game: {title:'Propune un joc', description:'Ce ți-ar plăcea să joci cu publicul tău?', icon:'fa-gamepad', hint:'Descrie jocul, cum intervin spectatorii și cum se câștigă o rundă.'},
        bug: {title:'Raportează o problemă', description:'Ceva nu funcționează cum ar trebui?', icon:'fa-bug', hint:'Ce s-a întâmplat? Ce te așteptai să se întâmple? Spune-ne pașii prin care putem reproduce problema.'},
        idea: {title:'Sugerează o îmbunătățire', description:'O schimbare care ți-ar face LIVE-ul mai bun.', icon:'fa-wand-magic-sparkles', hint:'Ce ai schimba sau adăuga? Cum te-ar ajuta în timpul LIVE-ului?'},
        question: {title:'Întreabă-ne orice', description:'Suntem aici și pentru întrebările mici.', icon:'fa-comment-dots', hint:'Scrie întrebarea ta și câteva detalii care ne-ar putea ajuta.'}
    };
    const dialog = document.createElement('dialog');
    dialog.id = 'site-support'; dialog.className = 'resource-support';
    dialog.setAttribute('aria-labelledby','resource-support-title');
    dialog.innerHTML = `<div class="support-topbar"><a class="support-brand" href="index.html"><img src="assets/tikinteract-icon-v2.png" width="25" height="25" alt=""><span>TIK<span>INTERACT</span></span></a><button type="button" class="support-icon-button" data-support-close aria-label="Închide suportul"><i class="fa-solid fa-xmark" aria-hidden="true"></i></button></div>
        <div class="support-content"><div class="support-intro">${robot}<span class="support-eyebrow">ÎMPREUNĂ ÎL FACEM MAI BUN</span><h2 id="resource-support-title">Cu ce te putem ajuta?</h2><p>O idee bună sau un lucru care nu merge? Spune-ne.</p></div>
        <div data-support-topics class="support-topics">${Object.entries(topics).map(([key,topic]) => `<button type="button" class="support-topic" data-support-topic="${key}"><span class="support-topic-icon"><i class="fa-solid ${topic.icon}" aria-hidden="true"></i></span><span><strong>${topic.title}</strong><small>${topic.description}</small></span><i class="fa-solid fa-arrow-right" aria-hidden="true"></i></button>`).join('')}</div>
        <section data-support-write hidden><button class="support-back" type="button" data-support-back><i class="fa-solid fa-arrow-left" aria-hidden="true"></i> Alt subiect</button><div class="support-write-heading"><span class="support-topic-icon"><i data-support-type-icon class="fa-solid" aria-hidden="true"></i></span><h3 data-support-type-title></h3></div>
        <form class="support-form"><div data-support-area hidden><label for="support-area">Unde apare problema?</label><select id="support-area" name="area"><option>LIVE Studio</option><option>Un joc</option><option>Conexiunea TikTok</option><option>Site / cont</option></select></div>
        <label for="support-message">Mesajul tău</label><textarea id="support-message" name="message" required minlength="20" maxlength="4000" rows="6"></textarea><span class="support-message-hint">Minimum 20 de caractere. Fără parole sau date de conectare.</span>
        <label for="support-email">E-mail pentru răspuns</label><input id="support-email" name="email" type="email" required maxlength="254" autocomplete="email" placeholder="nume@exemplu.ro">
        <button class="support-submit" type="submit"><i class="fa-regular fa-envelope" aria-hidden="true"></i> Continuă prin e-mail <i class="fa-solid fa-arrow-up-right-from-square" aria-hidden="true"></i></button>
        <p class="support-delivery-note">Se deschide aplicația ta de e-mail. Tu trimiți mesajul.</p><button class="support-copy" type="button" data-support-copy><i class="fa-regular fa-copy" aria-hidden="true"></i> Copiază mesajul</button><p class="support-form-status" data-support-status role="status"></p></form></section>
        <div class="support-bottom"><i class="fa-regular fa-envelope" aria-hidden="true"></i><a href="mailto:${config.supportEmail}">${config.supportEmail}</a></div></div>`;
    document.body.append(dialog);
    const picker = dialog.querySelector('[data-support-topics]'), write = dialog.querySelector('[data-support-write]'), form = dialog.querySelector('form');
    const message = form.elements.message, email = form.elements.email, status = dialog.querySelector('[data-support-status]');
    let activeTopic, previousFocus, drafts = {};
    function openSupport() {
        if (dialog.open) return;
        previousFocus = nav.contains(document.activeElement) ? trigger : document.activeElement; closeMenu();
        picker.hidden = false; write.hidden = true;
        dialog.querySelector('.support-intro').hidden = false;
        dialog.showModal();
    }
    function saveDraft() {if (activeTopic) drafts[activeTopic] = message.value;}
    document.addEventListener('click', event => {if (event.target.closest('[data-open-support]')) openSupport();});
    dialog.querySelector('[data-support-close]').addEventListener('click', () => dialog.close());
    dialog.addEventListener('close', () => {saveDraft(); if (previousFocus?.isConnected) previousFocus.focus({preventScroll:true});});
    dialog.addEventListener('click', event => {
        const box = dialog.getBoundingClientRect();
        if (event.target === dialog && (event.clientX < box.left || event.clientX > box.right || event.clientY < box.top || event.clientY > box.bottom)) dialog.close();
        const button = event.target.closest('[data-support-topic]');
        if (!button) return;
        activeTopic = button.dataset.supportTopic; const topic = topics[activeTopic];
        dialog.querySelector('[data-support-type-title]').textContent = topic.title;
        dialog.querySelector('[data-support-type-icon]').className = 'fa-solid ' + topic.icon;
        dialog.querySelector('[data-support-area]').hidden = activeTopic !== 'bug';
        message.placeholder = topic.hint; message.value = drafts[activeTopic] || ''; status.textContent = '';
        picker.hidden = true; write.hidden = false; dialog.querySelector('.support-intro').hidden = true;
        if (!email.value) email.value = window.tikInteractUser?.email || '';
        message.focus();
    });
    dialog.querySelector('[data-support-back]').addEventListener('click', () => {
        saveDraft(); picker.hidden = false; write.hidden = true; dialog.querySelector('.support-intro').hidden = false;
        picker.querySelector(`[data-support-topic="${activeTopic}"]`).focus();
    });
    message.addEventListener('input', () => message.setCustomValidity(''));
    function prepare() {
        message.setCustomValidity(message.value.trim().length < 20 ? 'Scrie cel puțin 20 de caractere.' : '');
        if (!activeTopic || !form.reportValidity()) return null;
        const body = `${topics[activeTopic].title}\n\n${message.value.trim()}\n\n${activeTopic === 'bug' ? 'Loc: ' + form.elements.area.value + '\n' : ''}E-mail pentru răspuns: ${email.value.trim()}`;
        return {body, url:`mailto:${config.supportEmail}?subject=${encodeURIComponent('[TikInteract] ' + topics[activeTopic].title)}&body=${encodeURIComponent(body)}`};
    }
    form.addEventListener('submit', event => {
        event.preventDefault(); const prepared = prepare(); if (!prepared) return;
        saveDraft(); const link = document.createElement('a'); link.href = prepared.url; link.click();
        status.textContent = 'Mesaj pregătit. Trimite-l din aplicația de e-mail. Dacă nu se deschide, copiază mesajul și scrie-ne la adresa de mai jos.';
    });
    dialog.querySelector('[data-support-copy]').addEventListener('click', async () => {
        const prepared = prepare(); if (!prepared) return;
        try {await navigator.clipboard.writeText(prepared.body); status.textContent = 'Mesaj copiat. Îl poți trimite la ' + config.supportEmail + '.';}
        catch {status.textContent = 'Copierea nu este disponibilă. Selectează textul mesajului și copiază-l manual.'; message.focus(); message.select();}
    });
    const footer = document.querySelector('.footer-links, .public-info-footer');
    if (footer) {
        const link = document.createElement('button'); link.type = 'button'; link.textContent = 'Suport'; link.dataset.openSupport = ''; footer.append(link);
    }
})();
