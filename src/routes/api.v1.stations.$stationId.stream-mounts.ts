import { createFileRoute } from "@tanstack/react-router";
import { jsonError, jsonSuccess, readJsonBody } from "@/server/api-response";

export const Route = createFileRoute("/api/v1/stations/$stationId/stream-mounts")({
  server: {
    handlers: {
      GET: async ({ params }) => {
        const { listStreamMounts } = await import("@/server/repositories/streaming.repository");
        const mounts = await listStreamMounts(params.stationId);
        return jsonSuccess(mounts);
      },
      POST: async ({ request, params }) => {
        const body = await readJsonBody(request);
        const mountPath = typeof body.mountPath === "string" ? body.mountPath.trim() : "";
        if (!mountPath) return jsonError("mountPath is required", "VALIDATION_ERROR");
        const { createStreamMount } = await import("@/server/repositories/streaming.repository");
        const mount = await createStreamMount({
          stationId: params.stationId,
          mountPath,
          format: typeof body.format === "string" ? body.format : undefined,
          bitrate: typeof body.bitrate === "number" ? body.bitrate : undefined,
          isDefault: typeof body.isDefault === "boolean" ? body.isDefault : undefined,
          sourcePassword: typeof body.sourcePassword === "string" ? body.sourcePassword : undefined,
        });
        return jsonSuccess(mount, 201);
      },
    },
  },
});
