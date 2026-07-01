import { createFileRoute } from "@tanstack/react-router";
import { jsonError, jsonSuccess } from "@/server/api-response";

export const Route = createFileRoute("/api/v1/scheduler/clock")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const url = new URL(request.url);
        const stationId = url.searchParams.get("stationId");
        if (!stationId) return jsonError("stationId query parameter is required", "MISSING_PARAM", 400);

        const { getClockView } = await import("@/server/scheduler/scheduler.service");
        const view = await getClockView(stationId);
        return jsonSuccess(view);
      },
    },
  },
});
