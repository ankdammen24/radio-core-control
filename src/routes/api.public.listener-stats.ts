/**
 * GET  /api/public/listener-stats  — Kräver x-stack-token
 * POST /api/public/listener-stats  — Kräver x-stack-token
 *
 * Migrerad från Supabase till Drizzle ORM.
 */
import { createFileRoute } from "@tanstack/react-router";
import { resolveStackToken, touchStackToken } from "@/server/repositories/stackTokens.repository";
import { findStationBySlug } from "@/server/repositories/stations.repository";
import { insertListenerStat, getListenerStats } from "@/server/repositories/listenerStats.repository";

async function auth(request: Request) {
  const raw = request.headers.get("x-stack-token") ?? "";
  if (!raw) return null;
  const tok = await resolveStackToken(raw);
  if (!tok) return null;
  return tok;
}

export const Route = createFileRoute("/api/public/listener-stats")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const tok = await auth(request);
        if (!tok) return new Response("Unauthorized", { status: 401 });

        const body = await request.json().catch(() => ({} as any));
        const slug: string | undefined = body.station_slug;

        let targetStationId = tok.stationId;
        if (slug) {
          const station = await findStationBySlug(slug);
          if (station) {
            // Cross-tenant guard
            if (tok.stationId && tok.stationId !== station.id) {
              return new Response("Forbidden", { status: 403 });
            }
            targetStationId = station.id;
          }
        }

        const clampInt = (v: unknown) => {
          const n = Number(v ?? 0);
          if (!Number.isFinite(n)) return 0;
          return Math.max(0, Math.min(1_000_000, Math.trunc(n)));
        };

        await insertListenerStat({
          stationId: targetStationId ?? undefined,
          mountPath: body.mount == null ? null : String(body.mount).slice(0, 200),
          listeners: clampInt(body.listeners),
          peakListeners: clampInt(body.peak ?? body.listeners),
        });

        return Response.json({ ok: true });
      },

      GET: async ({ request }) => {
        const tok = await auth(request);
        if (!tok) return new Response("Unauthorized", { status: 401 });

        const url = new URL(request.url);
        const slug = url.searchParams.get("station") ?? undefined;

        const data = await getListenerStats({
          stationId: tok.stationId ?? undefined,
          slug,
          limit: 200,
        });

        return Response.json({ data });
      },
    },
  },
});
