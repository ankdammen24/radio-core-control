import { createFileRoute } from "@tanstack/react-router";
import { jsonError, jsonSuccess, readJsonBody } from "@/server/api-response";

export const Route = createFileRoute("/api/v1/stations/$id")({
  server: {
    handlers: {
      GET: async ({ params }) => {
        const { findStationById } = await import("@/server/repositories/stations.repository");
        const station = await findStationById(params.id);
        if (!station) return jsonError("Station not found", "STATION_NOT_FOUND", 404);
        return jsonSuccess(station);
      },
      PATCH: async ({ request, params }) => {
        const body = await readJsonBody(request);
        const { updateStation } = await import("@/server/repositories/stations.repository");
        const station = await updateStation(params.id, {
          ...(typeof body.name === "string" ? { name: body.name } : {}),
          ...(typeof body.slug === "string" ? { slug: body.slug } : {}),
          ...(typeof body.description === "string" ? { description: body.description } : {}),
          ...(typeof body.accountId === "string" ? { accountId: body.accountId || null } : {}),
          ...(typeof body.azuracastStationId === "string"
            ? { azuracastStationId: body.azuracastStationId || null }
            : {}),
          ...(typeof body.isActive === "boolean" ? { isActive: body.isActive } : {}),
        });
        if (!station) return jsonError("Station not found", "STATION_NOT_FOUND", 404);
        return jsonSuccess(station);
      },
      DELETE: async ({ params }) => {
        const { deleteStation } = await import("@/server/repositories/stations.repository");
        const deleted = await deleteStation(params.id);
        if (!deleted) return jsonError("Station not found", "STATION_NOT_FOUND", 404);
        return new Response(null, { status: 204 });
      },
    },
  },
});
