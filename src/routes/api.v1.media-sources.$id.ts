import { createFileRoute } from "@tanstack/react-router";
import { jsonError, jsonSuccess, readJsonBody } from "@/server/api-response";

export const Route = createFileRoute("/api/v1/media-sources/$id")({
  server: {
    handlers: {
      GET: async ({ params }) => {
        const { findMediaSourceById } = await import("@/server/repositories/mediaSources.repository");
        const source = await findMediaSourceById(params.id);
        if (!source) return jsonError("Media source not found", "MEDIA_SOURCE_NOT_FOUND", 404);
        return jsonSuccess(source);
      },
      PATCH: async ({ request, params }) => {
        const body = await readJsonBody(request);
        const { updateMediaSource } = await import("@/server/repositories/mediaSources.repository");
        const source = await updateMediaSource(params.id, {
          ...(typeof body.name === "string" ? { name: body.name } : {}),
          ...(typeof body.baseUrl === "string" ? { baseUrl: body.baseUrl } : {}),
          ...(typeof body.authSecretName === "string" ? { authSecretName: body.authSecretName } : {}),
          ...(typeof body.isActive === "boolean" ? { isActive: body.isActive } : {}),
        });
        if (!source) return jsonError("Media source not found", "MEDIA_SOURCE_NOT_FOUND", 404);
        return jsonSuccess(source);
      },
      DELETE: async ({ params }) => {
        const { deleteMediaSource } = await import("@/server/repositories/mediaSources.repository");
        const deleted = await deleteMediaSource(params.id);
        if (!deleted) return jsonError("Media source not found", "MEDIA_SOURCE_NOT_FOUND", 404);
        return new Response(null, { status: 204 });
      },
    },
  },
});
