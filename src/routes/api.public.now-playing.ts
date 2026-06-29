/**
 * GET  /api/public/now-playing?station=<slug>  — Publik (ingen auth)
 * POST /api/public/now-playing                 — Kräver x-stack-token
 *
 * Migrerad från Supabase till Drizzle ORM.
 */
import { createFileRoute } from "@tanstack/react-router";
import { resolveStackToken, touchStackToken } from "@/server/repositories/stackTokens.repository";
import { findStationBySlug } from "@/server/repositories/stations.repository";
import { upsertNowPlaying, getNowPlaying, insertPlayHistory } from "@/server/repositories/nowPlaying.repository";

async function authStation(request: Request) {
  const raw = request.headers.get("x-stack-token") ?? "";
  if (!raw) return null;
  const tok = await resolveStackToken(raw);
  if (!tok) return null;
  await touchStackToken(tok.id);
  return { stationId: tok.stationId, tokenId: tok.id };
}

export const Route = createFileRoute("/api/public/now-playing")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const url = new URL(request.url);
        const slug = url.searchParams.get("station") ?? undefined;
        const data = await getNowPlaying(slug);
        return Response.json({ data });
      },

      POST: async ({ request }) => {
        const auth = await authStation(request);
        if (!auth) return new Response("Unauthorized", { status: 401 });

        const body = await request.json().catch(() => ({} as any));
        const slug: string | undefined = body.station_slug;
        if (!slug) return Response.json({ error: "station_slug required" }, { status: 400 });

        const station = await findStationBySlug(slug);
        if (!station) return Response.json({ error: "Unknown station" }, { status: 404 });

        if (auth.stationId && auth.stationId !== station.id) {
          return new Response("Forbidden", { status: 403 });
        }

        const cap = (v: unknown, n: number) => v == null ? null : String(v).slice(0, n);
        const listenersRaw = Number(body.listeners ?? 0);
        const listeners = Number.isFinite(listenersRaw)
          ? Math.max(0, Math.min(1_000_000, Math.trunc(listenersRaw))) : 0;

        await upsertNowPlaying({
          stationId: station.id,
          title: cap(body.title, 500),
          artist: cap(body.artist, 500),
          album: cap(body.album, 500),
          mountPath: cap(body.mount, 200),
          listeners,
          startedAt: new Date(),
        });

        await insertPlayHistory({
          stationId: station.id,
          title: cap(body.title, 500),
          artist: cap(body.artist, 500),
          album: cap(body.album, 500),
          listeners,
        });

        return Response.json({ ok: true });
      },
    },
  },
});
