import { createFileRoute } from "@tanstack/react-router";
import { jsonError, jsonSuccess, readJsonBody } from "@/server/api-response";

export const Route = createFileRoute("/api/v1/streaming-outputs/$id")({
  server: {
    handlers: {
      PATCH: async ({ request, params }) => {
        const body = await readJsonBody(request);
        const { updateStreamingOutput } = await import("@/server/repositories/streaming.repository");
        const output = await updateStreamingOutput(params.id, {
          ...(typeof body.name === "string" ? { name: body.name } : {}),
          ...(typeof body.type === "string" ? { type: body.type } : {}),
          ...(typeof body.host === "string" ? { host: body.host } : {}),
          ...(typeof body.port === "number" ? { port: body.port } : {}),
          ...(typeof body.mountpoint === "string" ? { mountpoint: body.mountpoint } : {}),
          ...(typeof body.username === "string" ? { username: body.username } : {}),
          ...(typeof body.password === "string" ? { password: body.password } : {}),
          ...(typeof body.format === "string" ? { format: body.format } : {}),
          ...(typeof body.bitrate === "number" ? { bitrate: body.bitrate } : {}),
          ...(typeof body.codec === "string" ? { codec: body.codec } : {}),
          ...(typeof body.sampleRate === "number" ? { sampleRate: body.sampleRate } : {}),
          ...(typeof body.channels === "number" ? { channels: body.channels } : {}),
          ...(typeof body.isEnabled === "boolean" ? { isEnabled: body.isEnabled } : {}),
          ...(typeof body.isPublic === "boolean" ? { isPublic: body.isPublic } : {}),
          ...(typeof body.useTls === "boolean" ? { useTls: body.useTls } : {}),
          ...(typeof body.priority === "number" ? { priority: body.priority } : {}),
        });
        if (!output) return jsonError("Streaming output not found", "STREAMING_OUTPUT_NOT_FOUND", 404);
        return jsonSuccess(output);
      },
      DELETE: async ({ params }) => {
        const { deleteStreamingOutput } = await import("@/server/repositories/streaming.repository");
        const deleted = await deleteStreamingOutput(params.id);
        if (!deleted) return jsonError("Streaming output not found", "STREAMING_OUTPUT_NOT_FOUND", 404);
        return new Response(null, { status: 204 });
      },
    },
  },
});
