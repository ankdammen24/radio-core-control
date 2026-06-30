import { createFileRoute } from "@tanstack/react-router";
import { jsonSuccess } from "@/server/api-response";

export const Route = createFileRoute("/api/v1/media-sources/$id/sync-runs")({
  server: {
    handlers: {
      GET: async ({ params }) => {
        const { listSyncRuns } = await import("@/server/repositories/mediaSources.repository");
        const runs = await listSyncRuns(params.id);
        return jsonSuccess(runs);
      },
    },
  },
});
