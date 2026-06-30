import { createFileRoute } from "@tanstack/react-router";
import { jsonError, jsonSuccess, readJsonBody } from "@/server/api-response";

export const Route = createFileRoute("/api/v1/stations")({
  server: {
    handlers: {
      GET: async () => {
        const { listStations } = await import("@/server/repositories/stations.repository");
        const stations = await listStations();
        return jsonSuccess(stations);
      },
      POST: async ({ request }) => {
        const body = await readJsonBody(request);
        const name = typeof body.name === "string" ? body.name.trim() : "";
        const slug = typeof body.slug === "string" ? body.slug.trim() : "";
        if (!name || !slug) {
          return jsonError("name and slug are required", "VALIDATION_ERROR");
        }
        const { createStation } = await import("@/server/repositories/stations.repository");
        const station = await createStation({
          name,
          slug,
          description: typeof body.description === "string" ? body.description : undefined,
          accountId: typeof body.accountId === "string" && body.accountId ? body.accountId : undefined,
          azuracastStationId:
            typeof body.azuracastStationId === "string" && body.azuracastStationId
              ? body.azuracastStationId
              : undefined,
        });
        return jsonSuccess(station, 201);
      },
    },
  },
});
