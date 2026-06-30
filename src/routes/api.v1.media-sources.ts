import { createFileRoute } from "@tanstack/react-router";
import { jsonError, jsonSuccess, readJsonBody } from "@/server/api-response";

export const Route = createFileRoute("/api/v1/media-sources")({
  server: {
    handlers: {
      GET: async () => {
        const { listMediaSources } = await import("@/server/repositories/mediaSources.repository");
        const sources = await listMediaSources();
        return jsonSuccess(sources);
      },
      POST: async ({ request }) => {
        const body = await readJsonBody(request);
        const name = typeof body.name === "string" ? body.name.trim() : "";
        const baseUrl = typeof body.baseUrl === "string" ? body.baseUrl.trim() : "";
        const contentType = body.contentType === "music" || body.contentType === "podcast" ? body.contentType : "";
        if (!name) return jsonError("name is required", "VALIDATION_ERROR");
        if (!baseUrl) return jsonError("baseUrl is required", "VALIDATION_ERROR");
        if (!contentType) return jsonError("contentType must be 'music' or 'podcast'", "VALIDATION_ERROR");
        const { createMediaSource } = await import("@/server/repositories/mediaSources.repository");
        const source = await createMediaSource({
          name,
          baseUrl,
          contentType,
          kind: typeof body.kind === "string" ? body.kind : undefined,
          authSecretName: typeof body.authSecretName === "string" ? body.authSecretName : undefined,
        });
        return jsonSuccess(source, 201);
      },
    },
  },
});
