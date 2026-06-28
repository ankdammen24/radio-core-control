/**
 * Distribution API — fetch a single episode (full metadata + streaming URL).
 */
import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/api/public/stations/$stationId/episodes/$episodeId")({
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
        const { data: ep, error } = await supabaseAdmin
          .from("podcast_episodes")
          .select(
            "id, podcast_id, guid, title, description, publish_date, duration_seconds, explicit, season, episode_number, audio_url, audio_format, artwork_url, transcript_url",
          )
          .eq("id", params.episodeId)
          .is("deleted_at", null)
          .maybeSingle();
        if (error || !ep) {
          return new Response(JSON.stringify({ error: "Episode not found" }), {
            status: 404,
            headers: { "Content-Type": "application/json" },
          });
        }

        // Verify station is subscribed to the podcast this episode belongs to
        const { data: sub } = await supabaseAdmin
          .from("station_podcast_subscriptions")
          .select("id, allow_explicit")
          .eq("station_id", auth.station.id)
          .eq("podcast_id", ep.podcast_id)
          .eq("is_active", true)
          .maybeSingle();
        if (!sub) {
          return new Response(JSON.stringify({ error: "Not subscribed" }), {
            status: 403,
            headers: { "Content-Type": "application/json" },
          });
        }
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        if (!(sub as any).allow_explicit && ep.explicit) {
          return new Response(JSON.stringify({ error: "Episode marked explicit; station disallows" }), {
            status: 403,
            headers: { "Content-Type": "application/json" },
          });
        }

        return new Response(
          JSON.stringify({
            station: auth.station,
            episode: {
              ...ep,
              streaming: {
                hls_url: ep.audio_format === "hls" ? ep.audio_url : null,
                mp3_url: ep.audio_format !== "hls" ? ep.audio_url : null,
              },
            },
          }),
          { status: 200, headers: { "Content-Type": "application/json", "Cache-Control": "private, max-age=60" } },
        );
      },
    },
  },
});
