# TikInteract Studio — Transmisie personalizabilă (demo HTML)

Deschide `index.html` în Chrome / Edge. Nu necesită instalare, cont sau server.

## Ce poți testa

- Trage panourile **direct din Transmisie**, apucând titlul lor (simbolul ⠿).
- Redimensionează din **colțul dreapta-jos** al fiecărui panou.
- Ascunde panouri cu X; recuperează-le din **Panouri**.
- Folosește **Blochează** când aranjamentul este bun.
- **Resetează** revine la aranjamentul inițial.
- Apasă + din Acces rapid pentru a adăuga/elimina favorite și trage favoritele pentru reordonare.
- Apasă butoanele de test pentru cursă, tap-tap, cadouri și conexiune TikFinity simulată.
- Aranjamentul și favoritele sunt memorate în **localStorage** în acel browser, nu în Supabase.

**Important:** acest prototip este inspirat de structura descrisă pentru TikInteract; accesul la aspectul exact al versiunii private Studio nu a putut fi validat prin linkul de invitație. Nu modifică site-ul și nu se conectează la OBS/TikFinity/Supabase.

Pentru integrarea reală cu Supabase, înlocuiește stocarea locală cu un tabel de preferințe per utilizator și păstrează mecanica pointer drag/resize în componentele dashboard-ului existent. Pentru framework-uri React poți utiliza o soluție tip grid layout care gestionează și coliziunile.
