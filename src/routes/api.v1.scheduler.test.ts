/**
 * POST /api/v1/scheduler/test
 *
 * Dry-run the scheduler at an arbitrary point in time.
 * Does NOT persist to scheduler_history.
 *
 * Body: { stationId: string, simulatedTime?: string (ISO-8601) }
 */
import { createFileRoute } from "@tanstack/react-router";
import { jsonError, jsonSuccess, readJsonBody } from "@/server/api-response";

export const Route = createFileRoute("/api/v1/scheduler/test")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const body = await readJsonBody(request);

        const stationId = typeof body.stationId === "string" ? body.stationId : null;
        if (!stationId) return jsonError("stationId is required", "MISSING_PARAM", 400);

        const simulatedTime =
          typeof body.simulatedTime === "string" ? new Date(body.simulatedTime) : undefined;
        if (simulatedTime && isNaN(simulatedTime.getTime())) {
          return jsonError("simulatedTime must be a valid ISO-8601 date string", "INVALID_PARAM", 400);
        }

        const { findStationById } = await import("@/server/repositories/stations.repository");
        const station = await findStationById(stationId);
        if (!station) return jsonError("Station not found", "STATION_NOT_FOUND", 404);

        const { decideNext } = await import("@/server/scheduler/scheduler.service");
        const decision = await decideNext({
          stationId: station.id,
          stationName: station.name,
          now: simulatedTime,
          persist: false,
        });

        return jsonSuccess({ ...decision, simulated: true });
      },
    },
  },
});
