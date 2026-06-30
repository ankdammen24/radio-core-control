import { createFileRoute } from "@tanstack/react-router";
import { jsonError, jsonSuccess, readJsonBody } from "@/server/api-response";

export const Route = createFileRoute("/api/v1/stations/$stationId/fallback-tracks")({
  server: {
    handlers: {
      GET: async ({ params }) => {
        const { listFallbackTracks } = await import("@/server/repositories/streaming.repository");
        const tracks = await listFallbackTracks(params.stationId);
        return jsonSuccess(tracks);
      },
      POST: async ({ request, params }) => {
        const body = await readJsonBody(request);
        const label = typeof body.label === "string" ? body.label.trim() : "";
        if (!label) return jsonError("label is required", "VALIDATION_ERROR");
        const { createFallbackTrack } = await import("@/server/repositories/streaming.repository");
        const track = await createFallbackTrack({
          stationId: params.stationId,
          label,
          externalUrl: typeof body.externalUrl === "string" ? body.externalUrl : undefined,
          mediaFileId: typeof body.mediaFileId === "string" ? body.mediaFileId : undefined,
          priority: typeof body.priority === "number" ? body.priority : undefined,
        });
        return jsonSuccess(track, 201);
      },
    },
  },
});
