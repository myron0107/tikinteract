# TIK Studio — dock flotant și interfață cinematică

Modificările acestei etape privesc exclusiv Studio. Nu s-au modificat index.html, prezentările jocurilor, abonamentele publice, landing page-ul AI sau navigația publică. Nu s-au făcut commit, push ori deploy.

## Utilizare

- Dock-ul pornește în stânga. Logo-ul și mânerul cu puncte de jos permit mutarea permanentă, separat de editorul panourilor. Lacătul se aplică ambelor mânere. Meniul este exclusiv vertical, cu dimensiune fixă; redimensionarea și comutarea orizontală au fost eliminate, inclusiv pentru preferințele salvate anterior.
- Lacătul blochează/deblochează poziția; săgeata circulară o resetează. Butoanele de navigare nu inițiază drag.
- Mânerul acceptă mouse, touchscreen și săgețile tastaturii; Shift + săgeată mută mai mult. Escape anulează o mutare în curs.
- Poziția este limitată la zona vizibilă și recalculată la redimensionare sau schimbarea înălțimii dock-ului.
- Poziția și blocarea sunt salvate local, separat per cont. Pentru utilizatorii autentificați se salvează și prin Supabase Auth `updateUser`, în `user_metadata.tik_studio_floating_dock_v1`. Sunt preferințe de interfață, fără rol în autorizare. Lipsa rețelei păstrează fallback-ul local. Nu sunt necesare tabele sau migrări noi.
- LIVE/AI schimbă meniul din același dock, fără configurator de panouri. Acasă, Jocuri, Sunete și Animații deschid direct secțiunea corespunzătoare; o singură secțiune este vizibilă. Acasă este deasupra lui Transmisie, iar separatorul este sub Transmisie. Conținutul original rămâne montat, iar poziția și dimensiunea fiecărei ferestre se păstrează. Răspunsurile AI întârziate nu readuc alte pagini în față.
- Selectorul LIVE/AI are doar iconițe SVG, denumiri accesibile și tooltip, cu evidențiere cyan/mov pentru opțiunea activă. Pe mobil iconițele sunt așezate una sub alta pentru a rămâne ușor de apăsat. Ghid AI ocupă locul ghidului Studio în partea inferioară a dock-ului când este ales meniul AI; în LIVE revine ghidul Studio.
- Comenzile contului, statisticile, diamantul cu soldul AI, limba, tema și paletele sunt într-o bară compactă, mutabilă din mânerul propriu. Soldul nu mai are text sau buton plus; apăsarea lui deschide creditele existente. „Înapoi la site” este separat de dock, jos în stânga. Ghidul rămâne discret în dock.
- Transmisie este singurul configurator de panouri: opțiuni pe două coloane, cu buline roșii pentru panouri ascunse și verzi pentru cele afișate. Sunt butoane accesibile `role=switch`, fără checkbox-uri vizibile. Ferestrele și panourile au X în dreapta sus. Închiderea nu șterge conținutul, favoritele sau sursa jocului. Monitorizarea locală, Stop și volumul sunt în antetul Bibliotecii de sunete, centrate; pe mobil trec sub titlu.
- Atmosfera aplică acum paleta meniurilor, suprafețelor și selecțiilor, cu preferințe LIVE/AI separate după meniul ales. Modul luminos folosește suprafețe mate și păstrează imaginea cinematică vizibilă, fără strat alb peste ea. Contururile sunt neutre și discrete; iconițele rămân colorate pe rol, iar ghidurile au aceeași culoare.
- Previzualizarea jocului păstrează `display:flex` și în aranjamentele personalizate. Aceasta previne prăbușirea containerului interior la înălțime zero; jocul încape în panou după mutare și redimensionare. Pornirea unui joc din AI revine la LIVE, fără a duplica iframe-ul.
- Titlurile ferestrelor și barele de scroll sunt uniforme. Pe mobil, lățimea inițială a paginii lasă loc dock-ului. Titlurile duplicate au fost eliminate.
- Ferestrele de cont rămân dialoguri accesibile, dar nemodale în noua interfață, astfel încât dock-ul rămâne utilizabil.
- Personalizarea panourilor rămâne în sistemul existent: mutare, redimensionare, vizibilitate, profiluri și resetare. Panourile se pot muta/redimensiona și fără activarea editorului; salvarea folosește RPC-ul existent. În Studio, mutarea este liberă, fără grilă, contur albastru sau previzualizare dreptunghiulară a poziției. Iframe-ul și sursele media nu sunt reconstruite când se mută/ascunde un panou sau se schimbă secțiunea.
- Preferințele desktop-ului (panouri selectate, secțiune activă, poziții/dimensiuni de ferestre, poziția barei de comenzi) au fallback local per cont și sincronizare în `user_metadata.tik_studio_desktop_v1`, fără tabele sau migrări noi.

## Design și imagine

Actualizările selectorului de fundal, meniurilor compacte, redimensionării, încărcării și limbii sunt descrise în [studio-appearance.md](studio-appearance.md). Cele trei peisaje aprobate sunt disponibile în „Aspectul studioului”, alături de fundalurile simple; fundalul implicit se adaptează la Light/Dark.

În „Alege atmosfera”, comutatorul „Fără paletă” dezactivează nuanțarea suprafețelor și a fundalului. Imaginea rămâne vizibilă, iar controalele folosesc griuri neutre în Light/Dark. Preferința este salvată local separat pentru LIVE și AI, păstrând paleta aleasă anterior. Dezactivarea comutatorului sau alegerea unei culori reactivează paleta. Verificat în browser: comutare, refresh, separarea LIVE/AI, imagine neschimbată și încadrare pe mobil.

Fundalul original anime/cyberpunk a fost generat cu instrumentul imagegen integrat și optimizat la JPEG de aproximativ 313 KiB: `assets/studio-cinematic.jpg`. Imaginea nu conține interfață, texte sau statistici. Folosește un singur fundal static, fără video ori animație continuă. Panourile au culori semitransparente; blurul este limitat la dock și panoul de setări. Modul luminos și preferințele existente rămân disponibile.

Promptul final folosit:

> Create a premium widescreen 16:9 anime cyberpunk background illustration for a desktop livestream gaming and AI creation application. This is ONLY the wallpaper, NOT a UI mockup. No text, no logos, no controls, no menus, no charts or floating panels. Cinematic night-time futuristic Japanese gaming studio with electric cyan and hot magenta neon. An adult anime woman streamer with dark flowing hair and gaming headphones is prominently on the far left, in a tasteful black futuristic jacket; an adult white-haired anime AI character on the far right with a small futuristic robotic cat. The middle 60 percent is a quieter deep navy transparent-looking night city / streaming room with luminous signs that have abstract marks, with beautiful depth and restrained light streaks and reflective desk surfaces along the bottom. Crisp hand-drawn anime, sophisticated mature artistic composition, dramatic lighting, rich detail at the sides with calm dark negative space in center to keep real application panels readable. No realistic photographic people. Do not draw any website interface.

## Fișierele acestei etape

- `live-studio.html`: dock-ul, comenzile contextuale și eliminarea barei superioare.
- `assets/studio-floating-dock.js`: pointer events, tastatură, blocare/resetare, limite și persistență.
- `assets/studio-floating-dock.css`: interfața cinematică și comportamentul responsive, limitate la Studio.
- `assets/studio-cinematic.jpg`: fundalul optimizat.
- `assets/studio-user-windows.js`: dialoguri de cont accesibile fără blocarea dock-ului.
- `assets/studio-personalization.js`: salvarea automată a ajustărilor în editorul existent.
- `assets/studio-widget-desktop.js` și `.css`: navigarea exclusivă, ferestrele mutabile, configuratorul Transmisie, persistența și antetul audio.
- `assets/studio-desktop-polish.css`: titluri, comenzi compacte, scroll, X, Light/Dark, mobil și mutare fără contur albastru.
- `assets/studio-atmosphere.css`: palete aplicate pe componente, Light mat fără ceață, contururi neutre, Acasă și configuratorul cu buline; corecția layout-ului previzualizării jocului.
- `tests/studio-workspace-ui.test.js`: contractul noii locații a comenzilor.
- `scripts/verify-studio-floating-dock.mjs`: verificarea în browser cu date izolate.
- `scripts/verify-studio-desktop.mjs`: verificarea comportamentului desktop actual în browser.
- `scripts/verify-studio-atmosphere.mjs`: verifică schimbarea efectivă a culorilor, persistența LIVE/AI separată, Acasă, încadrarea iframe-ului personalizat și fundalul luminos.
- Acest document.

## Validare

`npm.cmd test`: 181 de teste trecute.

Pentru previzualizare, pornește `npm.cmd run preview:studio`, apoi rulează `node scripts/verify-studio-desktop.mjs`. Previzualizarea ascultă doar pe 127.0.0.1:3033 și folosește date izolate de test.

După ultimele ajustări: 13 teste țintite trecute (`studio-structure`, `studio-workspace-ui`, `studio-session`, `studio-personalization`). Verificarea desktop actuală a trecut în Chrome: navigare exclusivă și rapidă LIVE/AI, titluri corecte, X pentru ferestre/panouri, credit compact, logo mutabil și blocabil, touchscreen, monitorizare/volum/Stop funcționale, persistență după refresh, joc păstrat, lipsa conturului albastru în timpul drag-ului, Light/Dark și mobil. Zero erori JavaScript în aceste scenarii.

Verificat în Chrome: mouse și touchscreen; tastatură; lock/reset; persistență după refresh; păstrarea poziției la navigare; clamp pe desktop și mobil; acces cont/AI; redimensionare de panou salvată prin RPC; păstrarea iframe-ului; Light/Dark; lipsa erorilor JavaScript. Salvarea preferinței dock prin Auth API a fost verificată cu un client izolat. Hash-urile fișierelor publice urmărite au rămas identice înainte/după.

Nu s-au pornit un LIVE real, plăți reale sau generări fal.ai plătite. Prețurile și regulile comerciale sunt păstrate.
