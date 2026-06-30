import { createFileRoute } from "@tanstack/react-router";
import { jsonError, jsonSuccess, readJsonBody } from "@/server/api-response";

export const Route = createFileRoute("/api/v1/live-inputs/$id")({
  server: {
    handlers: {
      PATCH: async ({ request, params }) => {
        const body = await readJsonBody(request);
        const { updateLiveInput } = await import("@/server/repositories/streaming.repository");
        const input = await updateLiveInput(params.id, {
          ...(typeof body.mountPath === "string" ? { mountPath: body.mountPath } : {}),
          ...(typeof body.harborPort === "number" ? { harborPort: body.harborPort } : {}),
          ...(typeof body.sourceUser === "string" ? { sourceUser: body.sourceUser } : {}),
          ...(typeof body.sourcePassword === "string" ? { sourcePassword: body.sourcePassword } : {}),
          ...(typeof body.format === "string" ? { format: body.format } : {}),
          ...(typeof body.bitrate === "number" ? { bitrate: body.bitrate } : {}),
          ...(typeof body.isEnabled === "boolean" ? { isEnabled: body.isEnabled } : {}),
          ...(typeof body.isLive === "boolean" ? { isLive: body.isLive } : {}),
          ...(typeof body.autoTakeover === "boolean" ? { autoTakeover: body.autoTakeover } : {}),
          ...(typeof body.forcedTakeover === "boolean" ? { forcedTakeover: body.forcedTakeover } : {}),
          ...(typeof body.notes === "string" ? { notes: body.notes } : {}),
        });
        if (!input) return jsonError("Live input not found", "LIVE_INPUT_NOT_FOUND", 404);
        return jsonSuccess(input);
      },
      DELETE: async ({ params }) => {
        const { deleteLiveInput } = await import("@/server/repositories/streaming.repository");
        const deleted = await deleteLiveInput(params.id);
        if (!deleted) return jsonError("Live input not found", "LIVE_INPUT_NOT_FOUND", 404);
        return new Response(null, { status: 204 });
      },
    },
  },
});
