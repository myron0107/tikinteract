# Administrare TikInteract

## Activare

1. Contul `mironsergiuflorin@gmail.com` trebuie să existe în platformă și să aibă e-mailul confirmat.
2. În Supabase → SQL Editor, deschide **New query**, lipește TOT fișierul `supabase/install-admin.sql` și apasă **Run**. Acesta instalează administrarea, mesageria și cheile de acces în ordinea corectă, într-o singură tranzacție. Dacă administrarea și suportul sunt deja instalate, rulează doar `supabase/access-keys.sql` pentru această actualizare.
3. După publicarea fișierelor site-ului, intră în cont și deschide **Administrare** din meniul contului sau accesează `/admin.html`.

Dacă ai primit `function public.site_admin_role() does not exist` când ai rulat `support.sql`, administrarea nu era încă instalată în proiectul Supabase ales. Rulează instalatorul complet de mai sus. Fișierele separate `admin.sql`, apoi `support.sql` rămân disponibile pentru actualizări. Dacă apare un mesaj despre o tranzacție anulată, rulează `ROLLBACK;` într-un query separat înainte de a reîncerca.

Pentru actualizarea instalatorului după modificarea scripturilor sursă: `node scripts/build-admin-install.mjs`.

Scriptul se poate rula din nou. Nu resetează configurația existentă, nu schimbă profilurile streamerilor și nu modifică tabelele cadourilor. Proprietarul inițial este atribuit prin SQL, nu prin e-mail verificat în JavaScript și nici prin metadate editabile ale utilizatorului.

## Grade

| Grad | Ciorne, jocuri, prețuri, conținut, Studio | Publicare | Gestionarea echipei |
|---|---|---|---|
| Proprietar | Da | Da | Da |
| Administrator | Da | Da | Nu |
| Editor | Da | Nu | Nu |

Proprietarul poate acorda sau retrage grade pentru conturi existente cu e-mail confirmat. Ultimul proprietar nu poate fi eliminat sau retrogradat. Datele echipei și configurațiile private nu sunt accesibile vizitatorilor.

## Mesaje și suport

**Mesaje** este o căsuță de conversații privată pentru proprietar și administratori. Editorii nu au acces la mesajele altor utilizatori.

- Utilizatorul intră în cont, deschide **Resurse → Suport**, alege un subiect și trimite mesajul. Cele patru categorii sunt propuneri de jocuri, probleme, sugestii și întrebări.
- Răspunzi direct din panou. Răspunsul apare pe site, în **Conversațiile mele** din Suport sau **MESAJELE MELE** din meniul contului. Mesajele noi au indicator de necitit.
- Conversațiile pot avea starea **De răspuns**, **În așteptare** sau **Rezolvat** și prioritate normală, mare sau urgentă. Pot fi atribuite unui proprietar ori administrator.
- Un răspuns al echipei mută conversația în așteptare. Un mesaj nou al utilizatorului redeschide conversația, inclusiv dacă era rezolvată.
- **Notă internă** salvează un mesaj vizibil doar proprietarului și administratorilor. Nu apare utilizatorului, în previzualizările lui sau în căutarea lui.
- Căutarea verifică subiectul și mesajele; pentru echipă include și e-mailul contului. Există filtre, paginare și încărcarea mesajelor mai vechi. Starea de citire este separată pentru fiecare membru.
- Lista deschisă se actualizează la 20 de secunde când pagina este vizibilă. Indicatorul din meniul contului verifică la 45 de secunde; există și actualizare manuală. Nu se pretinde livrare instantanee.
- Răspunsurile și notele se trimit imediat și nu folosesc fluxul de ciornă/publicare al configurației. Ciornele de răspuns se păstrează în memorie la schimbarea secțiunii, dar nu după reîncărcarea paginii. Deconectarea șterge conversația afișată și ciornele din memorie.

Nu este conectată o căsuță Gmail și nu se trimit e-mailuri sau notificări push. Mesajele din vechiul flux `mailto:` nu sunt importate. Sistemul gestionează conversațiile noi trimise de utilizatori pe platformă. La o eroare de rețea, reîncercarea aceleiași trimiteri folosește un ID unic pentru a evita dublurile.

Limitele pe server sunt 10 conversații noi/oră/cont, 60 mesaje/oră/utilizator și 300 mesaje/oră/membru al suportului, maximum 4.000 de caractere per mesaj. Conturile neconfirmate și anonime nu pot trimite. Atașamentele nu sunt incluse. Tabelele de suport au RLS și nu au acces direct pentru clienți; toate funcțiile verifică identitatea și permisiunile pe server.

## Fluxul de lucru

- **Salvează ciorna** păstrează modificările fără să schimbe site-ul public.
- **Previzualizare** arată ciorna în site sau în Studio, într-un iframe local aceleiași pagini. Configurația de previzualizare nu se publică și nu se salvează în conturile vizitatorilor.
- **Publică** verifică fișierele jocurilor și cere confirmarea. Publicarea actualizează simultan configurația publică și istoricul.
- Site-ul citește configurația publică la încărcare și verifică actualizările în paginile vizibile la fiecare minut. O nouă configurație nu pornește automat un joc.
- Dacă doi membri salvează din aceeași versiune, al doilea primește o eroare de conflict. Nu suprascriem în tăcere lucrul celuilalt.
- **Istoric → Restabilește ca ciornă** recuperează o versiune anterioară. Verifică previzualizarea și publică separat.

## Abonamente

Se pot edita numele, prețul lunar, moneda, beneficiile și vizibilitatea celor trei planuri. Prețurile sunt păstrate în bani/centime întregi pentru a evita erorile de rotunjire. Planul gratuit rămâne la preț zero.

Acesta este un editor de prețuri afișate. Nu debitează carduri, nu creează abonamente recurente și nu înlocuiește integrarea unui procesator de plăți. Accesul la planurile Play Pass și PRO se poate acorda acum prin chei. Pentru diferențierea jocurilor, alege planul fiecăruia din editorul catalogului și publică modificarea; jocurile existente rămân gratuite dacă nu schimbi această setare.

## Chei de acces / Access key

În **Chei de acces**, proprietarul și administratorii pot genera chei pentru **PLAY PASS** sau **PLAY PASS PRO**. Editorii nu pot genera, lista sau revoca chei.

- Durată: **1 lună, 3 luni, 6 luni sau 1 an / 12 luni**, calendaristice, calculate în UTC. Zilele de sfârșit de lună se ajustează la ultima zi disponibilă din luna rezultată.
- Generare: 1–25 de chei deodată, cel mult 250 într-o oră pentru fiecare administrator.
- Termen pentru activare: 7, 30, 90, 180 sau 365 de zile de la generare, ori fără termen. Acesta este independent de durata accesului, care începe când cheia este folosită.
- Opțional: etichetă internă și rezervare pentru un e-mail. O cheie rezervată funcționează numai pe un cont confirmat cu acea adresă.
- Codurile complete se afișează **o singură dată**. Copiază-le sau descarcă CSV. Baza de date păstrează doar amprenta SHA-256 și finalul codului, nu codul complet. Lista nu permite recuperarea lui. Dacă răspunsul generării se pierde, revocă seria din listă și generează alte chei.
- O cheie se activează într-un singur cont. Reîncercarea aceleiași chei de către același cont confirmă activarea existentă fără a dubla perioada. Alt cont nu o poate folosi.
- Cheile aceluiași plan extind accesul la finalul perioadei existente. PRO include jocurile Play Pass. La activarea PRO, timpul neconsumat Play Pass se mută după PRO. Un Play Pass activat când există PRO este programat după acesta. Perioadele programate sunt afișate în pagina PLAY PASS.
- **Revocă** dezactivează o cheie nefolosită. **Retrage accesul** revocă perioada asociată unei chei activate, fără să anuleze alte chei ale persoanei. Retragerea unui PRO nu mută automat mai devreme perioadele Play Pass deja programate; datele rămân cele afișate.
- Limita de activare este 15 încercări în 15 minute per cont confirmat. Încercările nereușite sunt contabilizate pe server. Utilizatorii anonimi sau neconfirmați nu pot activa chei.

Utilizatorul activează cheia în **PLAY PASS → Access key**. Planul și expirarea apar în PLAY PASS și CONTUL MEU. Nu există reînnoire automată. La expirare sau revocare, pagina vizibilă verifică drepturile la cel mult 30 de secunde; lansarea unui joc cu plan se confirmă separat pe server prin `check_game_access`. Nici activarea, nici actualizarea accesului nu pornesc automat un joc.

`access-keys.sql` actualizează doar textele de beneficii provizorii originale. Prețurile, jocurile și beneficiile deja personalizate sunt păstrate. Modificarea este adăugată în istoric dacă textele s-au schimbat; rerularea nu creează alte versiuni.

Protecția cheilor și drepturilor contului este pe server. Fișierele jocurilor rămân resurse statice publice în găzduirea actuală; sistemul nu pretinde protecție DRM pentru URL-uri directe. Înainte de încasări cu cardul, distribuția fișierelor pentru jocuri premium și confirmarea plăților trebuie protejate suplimentar pe server. Cheile nu inițiază plăți, nu expediază e-mailuri și nu oferă beneficii care nu există în jocuri.

## Jocuri

Poți adăuga numele, descrierea, coperta, fișierul HTML, pagina de prezentare, starea și nivelul de acces. Ordinea din listă determină ordinea catalogului și Game Center.

- **Ciornă**: jocul nu este afișat și nu este inclus în configurația publică.
- **Publicat**: jocul apare în catalog după publicarea configurației.
- **Dezactivat**: jocul este retras din catalog și Game Center, fără ștergerea fișierelor.

Coperta poate fi încărcată direct în panou: PNG, JPG sau WEBP, maximum 5 MB. Imaginile se salvează în bucket-ul public `site-media`; numai membrii echipei pot încărca, în propriul lor director.

Jocul și resursele sale trebuie să existe deja în proiect și să fie publicate, de exemplu `GAME/NUME-JOC/Joc.html`. Panoul nu încarcă arhive ZIP și nu execută HTML primit de la utilizatori. Pentru un joc nou, lasă pagina de prezentare necompletată pentru a folosi prezentarea cu copertă și descriere. Pentru comenzile și interacțiunile LIVE se folosește API-ul descris în `docs/game-live-api.md`.

Retragerea ascunde jocul din platformă; nu este o protecție împotriva accesării fișierelor statice prin URL direct. Fișierele vechilor jocuri rămân păstrate pentru reactivare ulterioară.

## LIVE Studio

Poți muta cele șase panouri între coloane și în interiorul aceleiași coloane, inversa coloanele pe desktop și alege densitatea normală sau compactă. Arena rămâne în centru. Toate cele șase panouri trebuie păstrate exact o dată. Pe mobil se aplică așezarea adaptată ecranului.

## Verificări

`npm test` include teste pe PostgreSQL local (PGlite), care rulează migrarea reală și verifică accesul anonim, rolurile, ciornele private, publicarea, istoricul, validarea datelor, conflictele și protecția ultimului proprietar.

Cu serverul local pornit, `node scripts/verify-admin.mjs` verifică și interfața în Chrome: ciorne, previzualizare, publicare, jocuri noi, prețuri, ordine Studio, echipă și mobil. Testul folosește exclusiv o bază PostgreSQL temporară și conturi simulate; nu modifică Supabase. Pentru alt port, setează `MEDIA_ROOT`, de exemplu `http://127.0.0.1:3005`.

`node scripts/verify-support.mjs` verifică trimiterea din site, răspunsul din admin, notele interne, atribuirea, redeschiderea unei conversații, păstrarea ciornei, mobilul și eliminarea datelor la deconectare, pe aceeași infrastructură izolată de test. `tests/support.test.js` verifică migrarea reală PostgreSQL, separarea conturilor, drepturile, căutarea privată, limitele, paginarea și trimiterile repetate.

`node scripts/verify-play-pass.mjs` verifică în browser cardurile, FAQ-ul, generarea, activarea unică, afișarea în cont, confirmarea lansării unui joc cu plan, revocarea, accesul gratuit și mobilul. Folosește exclusiv baza temporară de test. `tests/access-keys.test.js` verifică migrarea reală, permisiunile, duratele, prelungirile, upgrade-ul fără pierderea timpului Play Pass, sfârșitul de lună, rezervarea pe e-mail, limitele și revocarea.

În pagina publică se folosește numai cheia publică Supabase existentă. Nu introduce cheia `service_role` în HTML sau JavaScript. Tabelele de administrare sunt protejate prin RLS și fără drepturi directe pentru clienți; operațiile trec prin funcții cu verificarea rolului pe server.
