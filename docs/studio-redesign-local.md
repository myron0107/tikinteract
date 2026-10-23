# Studio — revizuire locală

Modificările sunt locale, nepublicate. Pagina principală publică, mecanicile jocurilor, transportul TikTok, contractele Supabase și Stripe nu sunt reconstruite.

## Interfață

- **Acasă:** salutul utilizatorului, pregătirea contului TikTok / jocului / sunetelor / animațiilor, jocurile publicate, acces la instrumente și ultimul LIVE disponibil în rapoartele reale. Nu se pornește automat niciun joc.
- **Transmisie:** scena în stânga, conexiunea și inspectorul în dreapta, biblioteca rapidă de favorite dedesubt. Inspectorul comută între controalele existente și public: chat, cadouri, susținători și contoare primite prin conectorul existent. Datele acestui panou sunt în memorie pentru sesiunea curentă; evenimentele de test și duplicatele sunt excluse.
- **Jocuri:** coperte complete de 200 px pe desktop și trei coloane pe mobil, etichetă FREE sau planul real, titlu și descriere scurtă dedesubt. NEW apare pentru publicări datate în ultimele 30 de zile; datele lipsă sau viitoare nu primesc eticheta. Cardul cu clopoțel anunță jocurile viitoare fără a simula un abonament la notificări. Apăsarea copertei lansează jocul, steluța gestionează favoritele.
- **Panou de sunete:** paduri colorate, filtre și monitorizare locală separată.
- **AI Studio:** canvas, universuri, fotografie, descriere, format și model într-un compozitor separat; bibliotecă, credite și ghid prin navigarea AI. Sunt folosite serviciile și verificările existente. Creditele AI au simbol de diamant și nu sunt prezentate ca bani.
- **Cont, abonament, securitate, suport, notificări și statistici:** componentele existente păstrate și adaptate vizual.
- **Aspect:** trei palete LIVE și trei AI, salvate separat, toate cu Light/Dark. Logo vectorial TIK STUDIO negru și roșu, fundal discret cu accente roșii și diagonale statice. RO/EN și navigare cu iconițe pe mobil. Panoul de palete are opțiuni complete, rămâne deschis după selecție și nu este închis de actualizările soldului.

Aranjamentele personale salvate sunt păstrate. Noua prezentare este afișată inițial; un aranjament personal vechi poate fi reactivat prin „Aranjament salvat”. Personalizarea, salvarea și publicarea implicitului administrativ folosesc în continuare infrastructura existentă. Mutarea panourilor păstrează iframe-ul jocului și conexiunea deschisă.

## Previzualizare izolată

```powershell
npm.cmd run preview:studio
```

Deschide `http://127.0.0.1:3033/live-studio.html`.

Acest server ascultă exclusiv pe loopback și folosește identitate, bază de date și sold în memorie pentru test. Bannerul din pagină identifică previzualizarea. Nu se efectuează plăți, generări AI plătite sau conexiuni TikTok reale. Datele dispar când serverul este oprit. Fișierele de test nu sunt incluse în publicarea Vercel.

Pagina normală rămâne `live-studio.html` pe serverul existent. Aceasta folosește autentificarea și backend-ul real configurat. Un server static simplu nu oferă rutele `/api/animations`; pentru acestea este necesar mediul de server existent.

## Validare

- `npm.cmd test`: 180 de teste trecute, inclusiv logica de acces, plăți/credite, RLS, evenimente și aranjamente, cu fixture-uri izolate.
- `node scripts/verify-studio-workspaces.mjs`: navigare nativă LIVE/AI, controale de bibliotecă, continuitatea iframe-ului/socket-ului, mutare/redimensionare, reordonare fără redare accidentală, salvare, izolarea conturilor, RO/EN și desktop/mobil.
- Cu `QA_DESIGN_REVIEW=1`: toate rutele/dialogurile, șase palete, Light/Dark, dimensiuni de 1440/390/320 px, închiderea paletei de la tastatură și persistența preferințelor.
- Verificare suplimentară pe previzualizarea locală: pagina Acasă, scenă inițială goală, filtre audio, păstrarea promptului/formatului/universului AI, mesaje LIVE tratate ca text, cadouri normalizate, ieșire din cont și refresh. Fără erori JavaScript observate.

Nu au fost verificate aici o sesiune TikTok publică, o plată reală sau o generare AI plătită. Redesignul nu activează aceste servicii.

## Fișiere

Interfață și integrare:

- `live-studio.html`
- `assets/studio-design.css`, `assets/studio-design.js`
- `assets/studio-home.js`
- `assets/studio-session-model.js`, `assets/studio-session-panel.js`
- `assets/studio-tik-signal.svg`, `assets/studio-tik-signal-light.svg`
- `assets/ai-generator-view.js`, `assets/ai-studio-views.js`
- `assets/animations-live-views.js`
- `assets/catalog-featured-data.js`
- `assets/account-layout.js`, `assets/platform.js`
- `assets/studio-workspaces.js`, `assets/studio-refresh.js`
- `assets/studio-personalization.js`

Instrumente și verificări:

- `package.json`
- `scripts/preview-studio.mjs`, `scripts/studio-preview-bootstrap.mjs`
- `scripts/studio-design-review.mjs`, `scripts/verify-studio-workspaces.mjs`
- `tests/studio-session.test.js`, `tests/studio-structure.test.js`, `tests/studio-workspace-ui.test.js`
- `tests/catalog-featured.test.js`

Nu s-au modificat chei, variabile de mediu, tabele Supabase, Stripe Prices sau configurarea fal.ai. Nu s-a făcut commit, push ori deploy.
