## Mål
Återspegla att den tidigare "Catalogus Media / Catalogus Musicus" nu heter **Fablesh** och att allt innehåll exponeras via dess API.

## Ändringar

**1. `src/routes/podcast-hub.tsx`** (rad 139)
Byt subtext från:
> "Audio is streamed from Catalogus Media — Radio Core only caches metadata."

till:
> "Audio streamas direkt från Fablesh via dess API — Radio Core cachar enbart metadata."

**2. `src/routes/index.tsx`** (rad 124)
Ersätt placeholder-kortet "Catalogus Musicus" med "Fablesh":
- Titel: `Fablesh`
- Body: `External media catalog — fully accessible via the Fablesh API.`

**3. `src/server/podcast-sync.server.ts`** (kommentar rad 7)
> "the Fablesh streaming URL passed through verbatim."

**4. `src/routes/api.public.stations.$stationId.podcasts.ts`** (kommentar rad 5)
> "Returns metadata only. Audio URLs point at Fablesh."

**5. `src/routes/api.public.stations.$stationId.podcasts.$podcastId.episodes.ts`** (kommentar rad 3)
> "Audio URLs point at Fablesh; Radio Core does not proxy audio."

## Utanför scope
- Ingen schemaändring, ingen ny endpoint — Fablesh REST-klienten (`fablesh-client.server.ts`) och Podcast Hub-källan är redan på plats.
- Inga UI-omstruktureringar utöver text/kort-byte.
