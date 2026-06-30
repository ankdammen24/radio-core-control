import { createFileRoute } from "@tanstack/react-router";
import { jsonError, jsonSuccess, readJsonBody } from "@/server/api-response";

export const Route = createFileRoute("/api/v1/stations/$stationId/streaming-outputs")({
  server: {
    handlers: {
      GET: async ({ params }) => {
        const { listStreamingOutputs } = await import("@/server/repositories/streaming.repository");
        const outputs = await listStreamingOutputs(params.stationId);
        return jsonSuccess(outputs);
      },
      POST: async ({ request, params }) => {
        const body = await readJsonBody(request);
        const name = typeof body.name === "string" ? body.name.trim() : "";
        if (!name) return jsonError("name is required", "VALIDATION_ERROR");
        const { createStreamingOutput } = await import("@/server/repositories/streaming.repository");
        const output = await createStreamingOutput({
          stationId: params.stationId,
          name,
          type: typeof body.type === "string" ? body.type : undefined,
          host: typeof body.host === "string" ? body.host : undefined,
          port: typeof body.port === "number" ? body.port : undefined,
          mountpoint: typeof body.mountpoint === "string" ? body.mountpoint : undefined,
          username: typeof body.username === "string" ? body.username : undefined,
          password: typeof body.password === "string" ? body.password : undefined,
          format: typeof body.format === "string" ? body.format : undefined,
          bitrate: typeof body.bitrate === "number" ? body.bitrate : undefined,
          codec: typeof body.codec === "string" ? body.codec : undefined,
          sampleRate: typeof body.sampleRate === "number" ? body.sampleRate : undefined,
          channels: typeof body.channels === "number" ? body.channels : undefined,
          isEnabled: typeof body.isEnabled === "boolean" ? body.isEnabled : undefined,
          isPublic: typeof body.isPublic === "boolean" ? body.isPublic : undefined,
          useTls: typeof body.useTls === "boolean" ? body.useTls : undefined,
          priority: typeof body.priority === "number" ? body.priority : undefined,
        });
        return jsonSuccess(output, 201);
      },
    },
  },
});
