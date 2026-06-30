import { createFileRoute } from "@tanstack/react-router";
import { jsonError, jsonSuccess, readJsonBody } from "@/server/api-response";

export const Route = createFileRoute("/api/v1/settings/stations/$stationId")({
  server: {
    handlers: {
      GET: async ({ params }) => {
        const { getStationSettings } = await import("@/server/repositories/settings.repository");
        const values = await getStationSettings(params.stationId);
        return jsonSuccess(values);
      },
      PATCH: async ({ request, params }) => {
        const body = await readJsonBody(request);
        const values =
          body.values && typeof body.values === "object" ? (body.values as Record<string, unknown>) : null;
        if (!values) return jsonError("values is required and must be an object", "VALIDATION_ERROR");
        const { upsertStationSettings } = await import("@/server/repositories/settings.repository");
        const updated = await upsertStationSettings(params.stationId, values);
        return jsonSuccess(updated);
      },
    },
  },
});
