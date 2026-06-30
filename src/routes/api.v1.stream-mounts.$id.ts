import { createFileRoute } from "@tanstack/react-router";
import { jsonError, jsonSuccess, readJsonBody } from "@/server/api-response";

export const Route = createFileRoute("/api/v1/stream-mounts/$id")({
  server: {
    handlers: {
      PATCH: async ({ request, params }) => {
        const body = await readJsonBody(request);
        const { updateStreamMount } = await import("@/server/repositories/streaming.repository");
        const mount = await updateStreamMount(params.id, {
          ...(typeof body.mountPath === "string" ? { mountPath: body.mountPath } : {}),
          ...(typeof body.format === "string" ? { format: body.format } : {}),
          ...(typeof body.bitrate === "number" ? { bitrate: body.bitrate } : {}),
          ...(typeof body.isDefault === "boolean" ? { isDefault: body.isDefault } : {}),
          ...(typeof body.isActive === "boolean" ? { isActive: body.isActive } : {}),
          ...(typeof body.sourcePassword === "string" ? { sourcePassword: body.sourcePassword } : {}),
        });
        if (!mount) return jsonError("Stream mount not found", "STREAM_MOUNT_NOT_FOUND", 404);
        return jsonSuccess(mount);
      },
      DELETE: async ({ params }) => {
        const { deleteStreamMount } = await import("@/server/repositories/streaming.repository");
        const deleted = await deleteStreamMount(params.id);
        if (!deleted) return jsonError("Stream mount not found", "STREAM_MOUNT_NOT_FOUND", 404);
        return new Response(null, { status: 204 });
      },
    },
  },
});
