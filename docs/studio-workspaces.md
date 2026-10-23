# LIVE Studio, AI Studio și aranjamente personale

Implementare în proiectul existent, în branch-ul `codex/studios-layout-finance`. Fără publicare automată și fără apeluri AI plătite în verificări.

## Același cont și aceleași servicii

- Comutatorul LIVE STUDIO / AI STUDIO se află în conținut. Bara laterală își păstrează dimensiunea și cele patru secțiuni; meniul de sus este păstrat.
- Acces direct AI: `live-studio.html?workspace=ai`. Acest acces nu pornește jocul sau transportul local LIVE. Revenirea în LIVE reutilizează transportul existent.
- AI Studio: Generator, Universuri, Biblioteca mea, Creditele mele, Istoric generări. LIVE → ANIMAȚII: biblioteca comună și regulile pentru evenimente.
- Se reutilizează aceeași sesiune Supabase, aceleași tabele și endpointuri, același portofel și aceleași permisiuni. Nu există un al doilea sistem de conturi.
- Generatorul păstrează fotografia, consimțământul, moderarea, etapa de imagine și etapa video Standard/Premium. Imaginile intermediare noi sunt afișate în biblioteca privată, alături de MP4-urile generate sau importate; nu se copiază încă o dată în Storage.
- Biblioteca are previzualizare, căutare, filtre imagini/video/univers, fan, descărcare și ștergere. „Trimite în LIVE” deschide configurarea unui eveniment pentru videoclipul selectat. Favoritele pot fi redate manual în coada existentă, fără o nouă generare AI.
- Soldurile incluse/cumpărate și istoricul sunt date reale. Consumul total folosește funcția SQL nouă; fără ea apare explicit că sumarul nu este disponibil.

## Personalizarea transmisiei

1. Intră în LIVE STUDIO → TRANSMISIE și apasă **Personalizează**.
2. Trage panourile din mânerul de sus sau din titlu; redimensionează din colțul din dreapta jos. Mișcarea urmărește cursorul prin `requestAnimationFrame`; poziția finală se fixează la 8 unități pe grila fină de pe întreaga suprafață.
3. Pozițiile sunt libere, fără mutarea automată a celorlalte panouri în coloane. Suprapunerea este permisă, la fel ca în referință. Suprafața se extinde în jos când este necesar.
4. Ascunde un panou cu X și readaugă-l din **Panouri**. **Favorite** permite adăugarea/eliminarea scurtăturilor. În timpul editării, trage jocurile, sunetele sau animațiile pentru a le reordona; gestul nu pornește redarea.
5. **Salvează / Blochează** păstrează profilul; **Anulează** revine la starea anterioară; **Resetează** revine la aranjamentul implicit al platformei.
6. Pot exista cel mult opt profiluri pentru fiecare cont. Desktop și mobil au coordonate separate. Pozițiile orizontale se adaptează la lățimea disponibilă.

Jocul și conexiunea LIVE nu se recreează. Editorul modifică exclusiv poziționarea CSS a acelorași elemente; nu mută iframe-ul în DOM. Escape sau pierderea ferestrei anulează gestul curent. Săgețile butoanelor mută panoul; săgețile tastaturii pe mânerul de redimensionare schimbă dimensiunea.

## Aranjamentul implicit stabilit de administrator

Proprietarul și administratorii văd **Setează ca implicit** în timpul personalizării. După aranjare, butonul deschide o confirmare și publică pozițiile, dimensiunile și vizibilitatea pentru desktop și mobil.

- Se aplică la intrare/reîncărcare utilizatorilor fără un aranjament personalizat și celor care folosesc **Resetează**.
- Profilurile personalizate existente rămân intacte. Nu se forțează schimbarea în mijlocul unei transmisii deja deschise.
- Favoritele, identificatorii fișierelor, conturile și datele personale ale administratorului nu sunt publicate. Serverul elimină aceste câmpuri, inclusiv metadatele suplimentare.
- Permisiunea este verificată pe server prin rolurile existente `owner` / `admin`. Rolul `editor` și conturile obișnuite nu pot publica, chiar dacă încearcă să apeleze direct funcția.
- Publicarea verifică revizia; două ferestre nu își suprascriu modificările în tăcere.

## Instalare în Supabase

Schema de bază de administrare/conturi și `supabase/animations.sql` trebuie să existe deja. În SQL Editor rulează:

1. `supabase/studio-workspaces.sql` — profiluri private, preferință activă, aranjament implicit administrativ și funcții securizate. Este repetabil și păstrează datele.
2. `supabase/animations-studios.sql` — sumarul privat al creditelor consumate/rezervate, separat Test/Live; accesibil doar serverului.
3. Pentru oferta financiară de test: `supabase/animations-commerce.sql`, conform `docs/animations-commerce.md`.

Nu s-a rulat nicio migrare pe Supabase online din această implementare. Fără schema aranjamentelor, editorul salvează local și afișează explicit **Doar pe acest dispozitiv**. Publicarea implicitului necesită schema; nu este simulată. Preferințele locale sunt separate după ID-ul contului; nu conțin fotografii, URL-uri private sau prompturi. Migrarea vechilor favorite locale este atribuită unui singur cont.

Profilurile au RLS pentru propriul utilizator, modificări doar prin funcții care verifică identitatea și revizia, maximum 8 profiluri și maximum 32 KB per aranjament. Tabelul implicitului nu poate fi modificat direct de browser. Nu este necesară o cheie `service_role` în client.

## Extindere

Un panou nou din suprafața transmisiei se înregistrează prin atributul `data-layout-panel="id-unic"` sau `TikInteractStudioPersonalization.registerPanel(id, element)`. Registrul îl adaugă în selector fără reconstruirea iframe-ului. Listele de favorite reutilizează catalogul real și biblioteca privată.

## Verificări și activare ulterioară

- `npm test`: teste PostgreSQL/RLS, credite, facturare, conector și jocuri existente, model de coordonate, profiluri și implicit administrativ.
- `node scripts/verify-studio-workspaces.mjs`: Chrome local cu PostgreSQL și utilizatori fictivi; mutare și resize continue, reordonare fără redare, iframe/socket păstrate, profiluri salvate/reîncărcate, implicit administrativ și izolare între conturi. Desktop 1440 px / mobil 390 px, RO/EN, Burgundy/Blue × Light/Dark.
- `node scripts/verify-animations-commerce.mjs`: oferta/creditele de test și interfața financiară, fără Checkout real.
- `node scripts/verify-animations-live.mjs`: flux complet cu furnizor AI și Storage controlați local, moderare, bibliotecă, fan, evenimente și overlay de test.

Generarea plătită, plățile Live și publicarea în producție rămân neactivate. Pentru activarea reală sunt necesare configurarea serviciilor, migrarea SQL, verificarea costurilor și aprobarea testului plătit, descrise în documentația existentă. Testarea LIVE din aceste verificări folosește un transport izolat; nu confirmă o transmisie TikTok reală.

Fișierele principale ale integrării: `live-studio.html`, `game.js`, `assets/studio-workspaces.*`, `assets/studio-personalization*`, `assets/animations-state.js`, `assets/animations-*-views.js`, `assets/studio-animations-entry.js`, `assets/studio-animations-live.js`, `assets/page-startup.js`, `lib/animations-service.js`, `lib/animations-store.js`, cele două migrări noi și testele/scripturile de verificare de mai sus.
