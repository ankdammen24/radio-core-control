import { createFileRoute } from "@tanstack/react-router";
import { jsonError, jsonSuccess, readJsonBody } from "@/server/api-response";

export const Route = createFileRoute("/api/v1/fallback-tracks/$id")({
  server: {
    handlers: {
      PATCH: async ({ request, params }) => {
        const body = await readJsonBody(request);
        const { updateFallbackTrack } = await import("@/server/repositories/streaming.repository");
        const track = await updateFallbackTrack(params.id, {
          ...(typeof body.label === "string" ? { label: body.label } : {}),
          ...(typeof body.externalUrl === "string" ? { externalUrl: body.externalUrl } : {}),
          ...(typeof body.mediaFileId === "string" ? { mediaFileId: body.mediaFileId } : {}),
          ...(typeof body.priority === "number" ? { priority: body.priority } : {}),
          ...(typeof body.isActive === "boolean" ? { isActive: body.isActive } : {}),
        });
        if (!track) return jsonError("Fallback track not found", "FALLBACK_TRACK_NOT_FOUND", 404);
        return jsonSuccess(track);
      },
      DELETE: async ({ params }) => {
        const { deleteFallbackTrack } = await import("@/server/repositories/streaming.repository");
        const deleted = await deleteFallbackTrack(params.id);
        if (!deleted) return jsonError("Fallback track not found", "FALLBACK_TRACK_NOT_FOUND", 404);
        return new Response(null, { status: 204 });
      },
    },
  },
});
