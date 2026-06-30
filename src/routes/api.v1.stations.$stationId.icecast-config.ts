import { createFileRoute } from "@tanstack/react-router";
import { jsonSuccess, readJsonBody } from "@/server/api-response";

export const Route = createFileRoute("/api/v1/stations/$stationId/icecast-config")({
  server: {
    handlers: {
      GET: async ({ params }) => {
        const { getIcecastConfig } = await import("@/server/repositories/streaming.repository");
        const config = await getIcecastConfig(params.stationId);
        return jsonSuccess(config);
      },
      PUT: async ({ request, params }) => {
        const body = await readJsonBody(request);
        const { upsertIcecastConfig } = await import("@/server/repositories/streaming.repository");
        const config = await upsertIcecastConfig(params.stationId, {
          ...(typeof body.hostname === "string" ? { hostname: body.hostname } : {}),
          ...(typeof body.port === "number" ? { port: body.port } : {}),
          ...(typeof body.sourcePassword === "string" ? { sourcePassword: body.sourcePassword } : {}),
          ...(typeof body.relayPassword === "string" ? { relayPassword: body.relayPassword } : {}),
          ...(typeof body.adminUser === "string" ? { adminUser: body.adminUser } : {}),
          ...(typeof body.adminPassword === "string" ? { adminPassword: body.adminPassword } : {}),
          ...(typeof body.adminEmail === "string" ? { adminEmail: body.adminEmail } : {}),
          ...(typeof body.location === "string" ? { location: body.location } : {}),
          ...(typeof body.maxClients === "number" ? { maxClients: body.maxClients } : {}),
          ...(typeof body.maxSources === "number" ? { maxSources: body.maxSources } : {}),
        });
        return jsonSuccess(config);
      },
    },
  },
});
