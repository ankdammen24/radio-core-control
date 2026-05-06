# On-demand musiktjänst kring Radio Core

## Rekommendation: bygg som **separat frontend-produkt**, men på **samma backend (Lovable Cloud)**

Kort svar: **både och**. Det är ett bra tillägg konceptuellt — men det ska INTE bo i Radio Core-appen. Radio Core är ett broadcast operations-verktyg för operatörer/admins. En on-demand-tjänst är en konsumentprodukt för lyssnare och artister. Olika användare, olika UX, olika säkerhetsmodell.

Däremot delar de naturligt:
- **Mediabibliotek** (`media_files`, storage, metadata)
- **Artister/presentatörer** (`presenters` → kan utökas till `artists`)
- **Auth-systemet** (samma `auth.users`, `user_roles`)
- **Statistik** (play_history, listener_stats)

Det betyder: en ny app som pratar med samma databas, men med egen frontend, egna routes, egna RLS-policies för de nya tabellerna.

## Varför inte i samma app?

| Aspekt | Radio Core (idag) | On-demand-tjänst |
|---|---|---|
| Målgrupp | Radiooperatörer, admins | Allmänhet + artister |
| Inloggning | Krävs alltid | Publik browsing, login för uppspelning |
| Innehåll | Schemalagd broadcast | Användarvald uppspelning |
| Roller | admin / editor / viewer | listener / artist / admin |
| UX | Tät, datadriven kontrollpanel | Visuell, mediacentrerad konsument-UI |

Att blanda dessa i en app gör båda sämre.

## Föreslagen arkitektur

```text
┌─────────────────────┐      ┌─────────────────────┐
│  Radio Core         │      │  On-demand app      │
│  (operatörspanel)   │      │  (lyssnare/artister)│
│  /admin-tunga vyer  │      │  /publika vyer      │
└──────────┬──────────┘      └──────────┬──────────┘
           │                            │
           └────────────┬───────────────┘
                        ▼
              ┌──────────────────┐
              │  Lovable Cloud   │
              │  (delad DB +     │
              │   storage +      │
              │   auth)          │
              └──────────────────┘
```

Två Lovable-projekt, samma backend. Radio Core fortsätter som idag. Den nya appen blir en "Radio Core Listen" (eller eget varumärke).

## Datamodell — nya tabeller

Utöka istället för att ändra befintliga:

- **artists** — artistprofil (kopplad till `auth.users`, ärver/utökar `presenters`)
- **tracks** — publik vy/tabell ovanpå `media_files` (titel, artist_id, genre, artwork, duration, is_published)
- **track_likes** — `(user_id, track_id)`, unik
- **track_comments** — `(user_id, track_id, body, created_at)`
- **user_playlists** — lyssnarens egna spellistor (skild från broadcast `playlists`)
- **user_playlist_tracks** — `(playlist_id, track_id, position)`
- **play_events** — on-demand uppspelningar (skilt från broadcast `play_history`)

## Roller

Lägg till i `app_role` enum:
- `listener` — default vid signup på lyssnar-appen
- `artist` — kan CRUD egna tracks, se egen statistik

Behåll `admin` / `editor` / `viewer` för Radio Core-sidan. Roller är inte exklusiva — en användare kan ha flera.

## RLS-mönster (kritiskt)

- **tracks SELECT**: publik (`anon` + `authenticated`) om `is_published = true` — listor syns för alla
- **track audio (storage)**: signerade URL:er, krävs `authenticated` — uppspelning kräver login
- **track INSERT/UPDATE/DELETE**: endast om `artist_id` matchar inloggad användare via `has_role('artist')`, eller `admin`
- **likes/comments**: `authenticated` skapar egna, alla ser aggregat
- **artist statistics**: bara egen artist eller admin

## Affärs-/scope-frågor att lösa innan bygge

1. Vem laddar upp musiken — artisten själv eller admin-godkännande först?
2. Behövs rättigheter/avtal-flöde (PRO/STIM-rapportering)?
3. Vilken ljudkvalitet/format ska levereras till lyssnare (mp3 128/192, eller HLS)?
4. Ska on-demand-tjänsten kunna spela radions livestream också, eller bara on-demand?
5. Monetisering på sikt (gratis/premium, annonser)?

## Förslag på nästa steg

Två alternativ — välj ett:

**A. Skapa nytt Lovable-projekt** (rekommenderas)
- Jag kan inte skapa det åt dig, du gör det från Lovable-startsidan.
- När det är skapat kopplar vi det till samma Lovable Cloud (samma DB).
- Vi börjar med: artist-/lyssnar-signup, publik track-katalog, uppspelning bakom login, likes.

**B. Prototypa inuti Radio Core under `/listen/*`**
- Snabbare att se något fungera, men kommer behöva flyttas senare.
- Risk: blandar konsument-UI i operatörsappen.

Säg vilket spår du vill köra, så detaljplanerar jag fas 1 (auth + roller + tracks-tabell + publik katalog + uppspelning).
