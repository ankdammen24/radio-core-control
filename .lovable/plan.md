
# Radio Core — Full översikt

Status snapshot inför att du ska designa och planera vidare. Inga kodändringar i detta läge.

## Vad Radio Core är

Ett white-label, fristående **radio-automationsprodukt** (potentiellt återförsäljbart). Master-system för en eller flera stationer. AzuraCast används som broadcast-runtime, men allt innehåll, schemaläggning och drift styrs härifrån. Ingen Radio Uppsala-specifik branding i kod — allt stationsdata kommer från DB.

## Arkitektur i dag

```text
Browser (React 19 + TanStack Start + shadcn/ui + Tailwind v4)
   │
   ├── Server functions (createServerFn) ── src/lib/*.functions.ts
   │      ↳ kör i Cloudflare Worker (nodejs_compat)
   │
   ├── Server-only helpers ─────────────── src/server/*.server.ts
   │      ↳ AzuraCast-klient, sync-worker, streaming-adaptrar
   │
   ├── Public API routes ───────────────── src/routes/api.public.*.ts
   │      ↳ now-playing, listener-stats, station-config, health, cron
   │
   └── Lovable Cloud (Postgres + Auth + Storage + Edge functions)
          ↳ pg_cron + pg_net schemalägger pull/push mot AzuraCast
          ↳ sync_jobs-kö med claim_sync_jobs() (FOR UPDATE SKIP LOCKED)
          ↳ legacy edge functions migreras gradvis till server fns

Runner (separat) ── runner/runner.py
   ↳ Liquidsoap/Icecast/Stereo Tool drivs av config från DB
```

## Datamodell — vad som finns

Stations & accounts: `accounts`, `stations`, `azuracast_connections`
Innehåll: `media_files`, `playlists`, `playlist_assignments`, `ad_campaigns`, `ad_spots`, `storage_locations`
Program: `shows`, `episodes`, `presenters`, `rundown_items`
Schemaläggning: `schedule_blocks`, `rotation_rules`
Drift: `now_playing`, `play_history`, `listener_stats`, `service_health`, `sync_jobs`
Streaming: `icecast_configs`, `liquidsoap_configs`, `stream_mounts`, `streaming_outputs`, `live_inputs`, `live_takeover_*`, `fallback_tracks`
Publik input: `song_requests`, `studio_messages`
Auth/admin: `profiles`, `roles`, `audit_logs`, `stack_tokens`

Allt har RLS efter mönstret select=auth, insert/update=editor, delete=admin.

## Etapper — leveransstatus

| Etapp | Innehåll | Status |
|---|---|---|
| 1 | AzuraCast-klient, sync-pipeline, pg_cron, cron-endpoint | Klar |
| 2 | Drift: skip/queue/restart, service-status, live listeners | Klar |
| 3 | Media + Playlists fullt CRUD med push, batch, custom fields, intro/fallback | Inte påbörjad |
| 4 | Streamers + Podcasts (nya tabeller, sidor, två-vägs sync) | Inte påbörjad |
| 5 | Mountpoints + Remote relays + Webhooks | Inte påbörjad |
| 6 | Admin (users/roles/storage/settings/backups/api-keys i AzuraCast) + song-request-sync | Inte påbörjad |

Övrigt klart utanför etapp-listan: Voicetrack-uppladdning, audio-processor (utan lamejs), grundsidor för Stations/Accounts/Users/Audit/Backup/Configs/Storage, Streaming Outputs, Fallback, Live, Inbox, Health.

## Sidomeny — nuläge vs. mål

```text
Drift           Now Playing · Live · Listeners · Health
Innehåll        Media · Playlists · Voicetracks · Ads · Inbox
Sändning        Schemaläggning · Rotation · Fallback · Streaming · Streaming Outputs
                + Mountpoints (kommer)
Program         Shows · Episoder
                + Streamers (kommer) · Podcasts (kommer)
Integrationer   AzuraCast · Sync Jobs
                + Webhooks (kommer)
Admin           Stationer · Konton · Användare · Roller · Storage · Konfig · Backup · Audit · Inställningar
```

## Tekniska invarianter att respektera i ny design

- Alla streaming-konfigar (Icecast/Liquidsoap/Stereo Tool/mounts/fallback/live) **genereras från DB** — appen är källan, ingen manuell .liq/.xml-redigering.
- Inga hårdkodade stationsdata, färger, logos, copy. Allt från `stations`-raden.
- Skrivningar: DB först → enqueue `sync_job` → worker pushar till AzuraCast → uppdaterar `azuracast_*_id` + `sync_dirty=false`.
- Read-only telemetri pullas (now_playing 1 min, listeners 5 min) via pg_cron.
- Konflikt: Radio Core vinner. AzuraCast är read-only för innehåll efter initial discovery.
- Server fns för all I/O. Edge functions bara kvar tills migrerade. Ingen direkt Worker-användning av child_process/sharp/etc.
- Design tokens i `src/styles.css` (oklch). Inga råa färger i komponenter.

## Designspår att fundera på inför nästa steg

Områden där en sammanhållen visuell + UX-riktning skulle lyfta produkten mest:

1. **Drift-vy (Now Playing + Health + Listeners)** — operatörens hem-skärm. Idag separata sidor; kan bli en "studio cockpit" med live-status, queue, skip, takeover, listenercount sida vid sida. Hög densitet, snabba actions, tydliga felstater.
2. **Sidomenyns gruppering** — växer snabbt med etapp 3-6. Behöver beslutas om: kollapsbara grupper, ikoner per grupp, station-switcher i toppen, sök över entiteter.
3. **Resurssidor (Media/Playlists/Streamers/Podcasts/Webhooks/Mountpoints)** — alla har samma mönster: lista + filter + bulk-actions + detalj-drawer/route + sync-status-badge. En gemensam "resource page"-mall sparar mycket tid.
4. **Sync-status överallt** — varje synkbar rad bör visa `synced / dirty / failed / pending` enhetligt. Idag bara på Sync Jobs-sidan.
5. **Multi-station** — station-switcher, scoped queries, "alla stationer"-vy för super-admin.
6. **Onboarding/empty states** — viktigt om produkten ska säljas: tom databas → guidad setup (skapa station → koppla AzuraCast → testa stream).
7. **White-label-yta** — var i UI:t ska kund-branding visas (logo, färg, namn)? Behöver tokens kopplade till `stations`-raden vid runtime.
8. **Publik yta** — `/now-playing`, `/song-requests`, `/studio-messages` är publika endpoints men har ingen publik UI. Vill du leverera en widget/embed-modul?

## Rekommenderad ordning härifrån

A. **Designspår först** — välj riktning för punkt 1-4 ovan (cockpit, sidomeny, resurssida-mall, sync-badge). Det styr hur etapp 3-6 ser ut.
B. **Etapp 3 (Media + Playlists fullt)** — största innehållsytan, sätter mallen för resterande resurssidor.
C. **Etapp 4-6** parallellt eller i ordning beroende på vad du säljer först.
D. **Multi-station + white-label** när minst en kund till är på väg in.

Säg till hur du vill gå vidare: vill du att jag gör design-direktioner (HTML-prototyper) för cockpit eller resurssida-mallen först, eller börjar bygga etapp 3 direkt på befintlig design?
