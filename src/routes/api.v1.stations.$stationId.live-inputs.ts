import { createFileRoute } from "@tanstack/react-router";
import { jsonSuccess, readJsonBody } from "@/server/api-response";

export const Route = createFileRoute("/api/v1/stations/$stationId/live-inputs")({
  server: {
    handlers: {
      GET: async ({ params }) => {
        const { listLiveInputs } = await import("@/server/repositories/streaming.repository");
        const inputs = await listLiveInputs(params.stationId);
        return jsonSuccess(inputs);
      },
      POST: async ({ request, params }) => {
        const body = await readJsonBody(request);
        const { createLiveInput } = await import("@/server/repositories/streaming.repository");
        const input = await createLiveInput({
          stationId: params.stationId,
          mountPath: typeof body.mountPath === "string" ? body.mountPath : undefined,
          harbourPort: typeof body.harbourPort === "number" ? body.harbourPort : undefined,
          sourceUser: typeof body.sourceUser === "string" ? body.sourceUser : undefined,
          sourcePassword: typeof body.sourcePassword === "string" ? body.sourcePassword : undefined,
          format: typeof body.format === "string" ? body.format : undefined,
          bitrate: typeof body.bitrate === "number" ? body.bitrate : undefined,
          isEnabled: typeof body.isEnabled === "boolean" ? body.isEnabled : undefined,
          autoTakeover: typeof body.autoTakeover === "boolean" ? body.autoTakeover : undefined,
          notes: typeof body.notes === "string" ? body.notes : undefined,
        });
        return jsonSuccess(input, 201);
      },
    },
  },
});
