/**
 * Distribution API — list podcasts a station is subscribed to.
 *
 * Auth: Authorization: Bearer <station-api-key>
 * Returns metadata only. Audio URLs point at Fablesh.
 */
import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/api/public/stations/$stationId/podcasts")({
  server: {
    handlers: {
      GET: async ({ request, params }) => {
        const { authenticateStationRequest } = await import("@/server/station-api-auth.server");
        const auth = await authenticateStationRequest(request, params.stationId);
        if (!auth.ok) {
          return new Response(JSON.stringify({ error: auth.message }), {
            status: auth.status,
            headers: { "Content-Type": "application/json" },
          });
        }

        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const { data, error } = await supabaseAdmin
          .from("station_podcast_subscriptions")
          .select(
            "priority, allow_explicit, only_swedish, max_episodes, podcasts(id,title,description,language,categories,artwork_url,owner,last_updated_at)",
          )
          .eq("station_id", auth.station.id)
          .eq("is_active", true)
          .order("priority", { ascending: false });

        if (error) {
          return new Response(JSON.stringify({ error: error.message }), {
            status: 500,
            headers: { "Content-Type": "application/json" },
          });
        }

        const podcasts = (data ?? [])
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          .map((row: any) => row.podcasts ? {
            id: row.podcasts.id,
            title: row.podcasts.title,
            description: row.podcasts.description,
            language: row.podcasts.language,
            categories: row.podcasts.categories ?? [],
            artwork_url: row.podcasts.artwork_url,
            owner: row.podcasts.owner,
            last_updated_at: row.podcasts.last_updated_at,
            priority: row.priority,
            allow_explicit: row.allow_explicit,
            only_swedish: row.only_swedish,
            max_episodes: row.max_episodes,
          } : null)
          .filter(Boolean);

        return new Response(JSON.stringify({ station: auth.station, podcasts }), {
          status: 200,
          headers: { "Content-Type": "application/json", "Cache-Control": "private, max-age=60" },
        });
      },
    },
  },
});
