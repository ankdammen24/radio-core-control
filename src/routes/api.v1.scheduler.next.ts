import { createFileRoute } from "@tanstack/react-router";
import { jsonError, jsonSuccess } from "@/server/api-response";

export const Route = createFileRoute("/api/v1/scheduler/next")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const url = new URL(request.url);
        const stationId = url.searchParams.get("stationId");
        const persist = url.searchParams.get("persist") === "true";

        if (!stationId) return jsonError("stationId query parameter is required", "MISSING_PARAM", 400);

        const { findStationById } = await import("@/server/repositories/stations.repository");
        const station = await findStationById(stationId);
        if (!station) return jsonError("Station not found", "STATION_NOT_FOUND", 404);

        const { decideNext } = await import("@/server/scheduler/scheduler.service");
        const decision = await decideNext({
          stationId: station.id,
          stationName: station.name,
          persist,
        });

        return jsonSuccess(decision);
      },
    },
  },
});
