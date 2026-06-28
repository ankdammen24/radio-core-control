/**
 * Distribution API — list episodes of a podcast for a station.
 * Audio URLs point at Fablesh; Radio Core does not proxy audio.
 */
import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute(
  "/api/public/stations/$stationId/podcasts/$podcastId/episodes",
)({
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

        // Verify station has an active subscription to this podcast
        const { data: sub } = await supabaseAdmin
          .from("station_podcast_subscriptions")
          .select("id, allow_explicit, max_episodes")
          .eq("station_id", auth.station.id)
          .eq("podcast_id", params.podcastId)
          .eq("is_active", true)
          .maybeSingle();
        if (!sub) {
          return new Response(JSON.stringify({ error: "Not subscribed" }), {
            status: 403,
            headers: { "Content-Type": "application/json" },
          });
        }

        let q = supabaseAdmin
          .from("podcast_episodes")
          .select(
            "id, guid, title, description, publish_date, duration_seconds, explicit, season, episode_number, audio_url, audio_format, artwork_url, transcript_url",
          )
          .eq("podcast_id", params.podcastId)
          .is("deleted_at", null)
          .order("publish_date", { ascending: false, nullsFirst: false });
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        if (!(sub as any).allow_explicit) q = q.eq("explicit", false);
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        if ((sub as any).max_episodes) q = q.limit((sub as any).max_episodes);

        const { data, error } = await q;
        if (error) {
          return new Response(JSON.stringify({ error: error.message }), {
            status: 500,
            headers: { "Content-Type": "application/json" },
          });
        }

        return new Response(
          JSON.stringify({ station: auth.station, podcast_id: params.podcastId, episodes: data ?? [] }),
          { status: 200, headers: { "Content-Type": "application/json", "Cache-Control": "private, max-age=60" } },
        );
      },
    },
  },
});
