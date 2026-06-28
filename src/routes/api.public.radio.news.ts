/**
 * Radio Core integration API — list broadcast-ready news items.
 *
 * Auth: `Authorization: Bearer <station-api-key>` (or `X-API-Key`).
 * Only items with status='ready_for_radio' (or 'broadcasted' on request)
 * are returned. Audio URL is null when audio generation is still pending.
 *
 * This endpoint is station-independent — the API key resolves to a station.
 */
import { createFileRoute } from "@tanstack/react-router";

const ALLOWED_STATUS = new Set(["ready_for_radio", "broadcasted"]);

export const Route = createFileRoute("/api/public/radio/news")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const { authenticateStationByKey } = await import("@/server/station-api-auth.server");
        const auth = await authenticateStationByKey(request);
        if (!auth.ok) {
          return Response.json({ error: auth.message }, { status: auth.status });
        }

        const url = new URL(request.url);
        const q = url.searchParams;

        const status = q.get("status");
        const statusFilter = status && ALLOWED_STATUS.has(status) ? status : "ready_for_radio";

        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        let query = supabaseAdmin.from("news_items").select("*").eq("status", statusFilter);

        const region = q.get("region");
        if (region) query = query.eq("region", region);
        const municipality = q.get("municipality");
        if (municipality) query = query.eq("municipality", municipality);
        const category = q.get("category");
        if (category) query = query.eq("category", category);
        const priority = q.get("priority");
        if (priority) query = query.eq("priority", priority);
        const language = q.get("language");
        if (language) query = query.eq("language", language);
        if (q.get("hasAudio") === "true") query = query.not("audio_url", "is", null);

        const expiresAfter = q.get("expiresAfter");
        if (expiresAfter) {
          const d = new Date(expiresAfter);
          if (!isNaN(d.getTime())) query = query.gt("expires_at", d.toISOString());
        } else {
          // Hide expired items by default
          query = query.or(`expires_at.is.null,expires_at.gt.${new Date().toISOString()}`);
        }

        const limitRaw = Number(q.get("limit") ?? "50");
        const limit = Math.min(Math.max(Number.isFinite(limitRaw) ? limitRaw : 50, 1), 200);
        query = query.order("priority", { ascending: false })
          .order("published_at", { ascending: false, nullsFirst: false })
          .limit(limit);

        const { data, error } = await query;
        if (error) return Response.json({ error: error.message }, { status: 500 });

        const { mapNewsItem } = await import("@/server/news-mapper.server");
        return Response.json({
          station: auth.station,
          count: data?.length ?? 0,
          items: (data ?? []).map(mapNewsItem),
        }, { headers: { "Cache-Control": "private, max-age=30" } });
      },
    },
  },
});
