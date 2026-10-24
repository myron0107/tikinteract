# Ieșirea jocului și corecțiile Studio

## Utilizare

1. Pornește un joc în Studio.
2. În panoul Interfață, deschide **OBS / TikTok — Joc** și apasă **Pornește ieșirea jocului**.
3. În dialogul browserului, selectează fila Studio. Este publicat numai conținutul jocului și al animațiilor redate peste el.
4. Copiază **linkul jocului** în Browser Source din OBS sau în sursa Link din TikTok LIVE Studio. Setează 1080 × 1920 pentru vertical sau 1920 × 1080 pentru orizontal.

Păstrează Studio deschis pe calculatorul cu aplicația de transmisie. Implementarea folosește conexiune directă WebRTC pe același calculator/rețea locală, fără serviciu TURN. Editorul trebuie deschis într-un browser desktop care oferă Element Capture și mutarea DOM cu păstrarea stării; verificat în Chrome. Aplicațiile OBS și TikTok LIVE Studio nu au fost controlate în verificarea automată: receptorul a fost verificat într-un al doilea proces Chrome, cu profil separat și fără autentificare.

Linkul rămâne același după închiderea jocului și alegerea altuia. **X** cere Da/Nu, oprește jocul și ascunde fereastra lui. Butonul mic **OPRIRE** cere aceeași confirmare și lasă fereastra disponibilă. Ambele păstrează ieșirea OBS; **Oprește ieșirea** o oprește separat. După refresh trebuie acordată din nou permisiunea browserului, folosind același link salvat. Schimbarea linkului privat invalidează sursa veche.

Cursorul transmis este ascuns implicit. Opțiunea **Afișează cursorul în sursa OBS** îl activează în joc. Cursorul operatorului este desenat separat, în afara conținutului transmis. Preferința se salvează local pentru cont.

## Animații și navigare

Profilul **DEFAULT** reproduce așezarea din referință: favorite în stânga, Interfață în centru, conexiune și controale în dreapta, chat sub Interfață. În **Profiluri**, alege **DEFAULT → LOAD** pentru a aplica această așezare unui cont existent. Celelalte profiluri se păstrează. Pe telefon, DEFAULT devine o listă de panouri cu scroll tactil; geometria pentru desktop și mobil rămâne separată. Modificarea manuală a panourilor se salvează prin sistemul existent de profiluri. Setările implicite publicate de administrator continuă să fie respectate pentru conturile noi; nu s-a publicat automat un aranjament global în Supabase.

Titlul și opțiunea din Transmisie se numesc **Interfață**, cu iconiță de monitor. În Aspect sunt disponibile și **Ocean, Mint, Amethyst, Rosewood, Sage, Steel, Graphite, Midnight**, atât în LIVE cât și în AI: 11 opțiuni per spațiu, plus Fără paletă. Se păstrează salvarea separată a paletei și fundalului.

- Favorite animații: adăugare prin steaua clipului, redare la apăsare și **Deschide Animații**, care deschide pagina LIVE. Butonul Sursă animații a fost eliminat din Favorite.
- Redarea din Favorite apare și peste joc în linkul OBS al jocului. Sursa separată de animații rămâne disponibilă în Evenimentele paginii Animații, pentru aranjamente independente. Folosește sursa potrivită aranjamentului pentru a evita afișarea aceluiași clip de două ori.
- **Redenumește** salvează titlul în cont și îl actualizează în Favorite. Fișierul, identificatorul, regulile și favoritele nu sunt schimbate.
- Scurtăturile **Sound pad**, **Deschide Jocuri** și **Adaugă un joc în scenă** deschid ferestrele corespunzătoare prin controllerul actual al desktopului. Favoritele audio au pătrate compacte de 76 px pe desktop și 72 px pe mobil, fără întindere odată cu fereastra.
- Evenimente LIVE este jurnalul comun al comentariilor, cadourilor și like-urilor. Chat și susținători oferă conversațiile/cadourile pe categorii și clasamentul susținătorilor. Jurnalul a fost păstrat și are un fundal uniform pe întreaga fereastră, în ambele teme.
- Meniul restrâns are o iconiță cu patru instrumente. Mutarea și extinderea meniului se păstrează.

## Implementare

Jocul nu este lansat a doua oară în receptor. Iframe-ul existent este mutat cu `moveBefore`, păstrând documentul, starea, comenzile și sunetul. Un container persistent, izolat, este restrâns prin `RestrictionTarget`; fluxul este trimis către receptor prin WebRTC. Studio afișează o previzualizare a aceluiași flux. Schimbarea secțiunii sau a dimensiunilor panourilor nu mută sursa transmisă în afara zonei sale stabile. Animațiile sunt redate în acest container când ieșirea este activă și revin în previzualizarea normală când ieșirea este oprită.

Supabase Realtime existent transportă numai negocierile criptate AES-GCM. Răspunsul editorului este semnat ECDSA; cheia privată a editorului și tokenurile contului nu intră în URL. Receptorul nu primește comenzi de control. Nu se adaugă tabele sau migrări Supabase. Nu se modifică Stripe, tarifele sau generarea AI și nu se lansează apeluri AI plătite.

Fișiere principale:

- `game-output.html`, `assets/game-output-protocol.js`, `assets/game-output-signaling.js`, `assets/game-output-viewer.js`.
- `assets/studio-game-output.js`, `assets/studio-game-lifecycle.js`, `assets/studio-broadcast-sources.js`, `assets/studio-broadcast.css`, `assets/studio-animation-player.js`.
- `assets/studio-personalization.js`, `assets/studio-widget-desktop.js`, `assets/studio-layout.js`, `assets/studio-floating-dock.js`, `assets/studio-refresh.js`, `assets/studio-mobile.css`, `live-studio.html`.
- `assets/studio-default-layout.js`, `assets/studio-personalization-model.js`, `assets/studio-design.js`, `assets/studio-atmosphere.css`: profilul DEFAULT responsive și paletele noi.
- `assets/animations-rule-form.js`, `assets/animations-live-rules.js`, `assets/animations-live-bridge.js`, `assets/animations-live-views.js`, `assets/animations-media-views.js`, `assets/studio-animations-live.js`, `lib/animations-service.js`.
- `animation-overlay.html`, `assets/animation-overlay.js`: încadrarea sursei separate de videoclipuri.
- `assets/site-app.js`: anularea verificărilor de lansare rămase în așteptare după închiderea unui joc în Studio; fără modificarea navigației sau aspectului public.
- `assets/ai-generator-view.js`, `assets/animations-workspace-views.js`, `assets/studio-animations-entry.js`, `assets/studio-workspaces.js`: versiuni ale importurilor/cache-ului.
- `assets/vendor/supabase-output.js` și licența MIT: SDK 2.95.3 deja instalat în proiect, încărcat local numai pentru ieșire.

## Verificare

Testele `game-output.test.js`, `animations-scene.test.js`, `animations-service.test.js`, `studio-layout.test.js` și testele existente pentru autentificare, evenimente, sesiune, controale, structură, pornire și profiluri au trecut.

`studio-default-layout.test.js` verifică încadrarea și lipsa suprapunerilor. `node scripts/verify-studio-default.mjs` verifică în fixture-ul local DEFAULT la 1920, 1024, 700, 390 și 320 px, păstrarea profilurilor, scroll-ul cu evenimente touch, iconița Interfață, paletele și salvarea preferințelor.

Pentru verificarea în browser: pornește `npm run preview:studio`, apoi rulează `node scripts/verify-game-output.mjs`. Scriptul refuză conturile reale și cere fixture-ul local. Folosește două profiluri Chrome izolate, acord automat pentru fila fixture-ului, jocuri reale locale și un clip de test. Verifică aceeași sesiune, portret/orizontal, redare prin link fără login, X Da/Nu, OPRIRE, schimbarea jocului cu sursa păstrată, clipul favorit peste joc, redenumire, navigare, cursor opțional și ambele teme ale jurnalului. Negocierea WebRTC folosește un canal Supabase Realtime aleator, fără scrieri în baza de date a proiectului. Capturile de verificare sunt în `.tools/`, exclus din deploy.

Nu s-a făcut commit, push sau deploy în această etapă.
