import { createFileRoute } from "@tanstack/react-router";
import { jsonSuccess, readJsonBody } from "@/server/api-response";

export const Route = createFileRoute("/api/v1/stations/$stationId/liquidsoap-config")({
  server: {
    handlers: {
      GET: async ({ params }) => {
        const { getLiquidsoapConfig } = await import("@/server/repositories/streaming.repository");
        const config = await getLiquidsoapConfig(params.stationId);
        return jsonSuccess(config);
      },
      PUT: async ({ request, params }) => {
        const body = await readJsonBody(request);
        const { upsertLiquidsoapConfig } = await import("@/server/repositories/streaming.repository");
        const config = await upsertLiquidsoapConfig(params.stationId, {
          ...(typeof body.telnetHost === "string" ? { telnetHost: body.telnetHost } : {}),
          ...(typeof body.telnetPort === "number" ? { telnetPort: body.telnetPort } : {}),
          ...(typeof body.crossfadeSeconds === "number" ? { crossfadeSeconds: body.crossfadeSeconds } : {}),
          ...(typeof body.normalizeAudio === "boolean" ? { normalizeAudio: body.normalizeAudio } : {}),
          ...(typeof body.fallbackTrackPath === "string" ? { fallbackTrackPath: body.fallbackTrackPath } : {}),
          ...(typeof body.customLiq === "string" ? { customLiq: body.customLiq } : {}),
        });
        return jsonSuccess(config);
      },
    },
  },
});
