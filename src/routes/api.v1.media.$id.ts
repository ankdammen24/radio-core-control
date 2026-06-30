import { createFileRoute } from "@tanstack/react-router";
import { jsonError, jsonSuccess, readJsonBody } from "@/server/api-response";

export const Route = createFileRoute("/api/v1/media/$id")({
  server: {
    handlers: {
      GET: async ({ params }) => {
        const { findMediaById } = await import("@/server/repositories/mediaAssets.repository");
        const media = await findMediaById(params.id);
        if (!media) return jsonError("Media not found", "MEDIA_NOT_FOUND", 404);
        return jsonSuccess(media);
      },
      PATCH: async ({ request, params }) => {
        const body = await readJsonBody(request);
        const { updateMedia } = await import("@/server/repositories/mediaAssets.repository");
        const media = await updateMedia(params.id, {
          ...(typeof body.fileName === "string" ? { fileName: body.fileName } : {}),
          ...(typeof body.fileType === "string" ? { fileType: body.fileType } : {}),
          ...(typeof body.mediaKind === "string" ? { mediaKind: body.mediaKind } : {}),
          ...(typeof body.status === "string" ? { status: body.status } : {}),
          ...(typeof body.durationSeconds === "number" ? { durationSeconds: body.durationSeconds } : {}),
        });
        if (!media) return jsonError("Media not found", "MEDIA_NOT_FOUND", 404);
        return jsonSuccess(media);
      },
      DELETE: async ({ params }) => {
        const { deleteMedia } = await import("@/server/repositories/mediaAssets.repository");
        const deleted = await deleteMedia(params.id);
        if (!deleted) return jsonError("Media not found", "MEDIA_NOT_FOUND", 404);
        return new Response(null, { status: 204 });
      },
    },
  },
});
