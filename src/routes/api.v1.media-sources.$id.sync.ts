import { createFileRoute } from "@tanstack/react-router";
import { jsonSuccess } from "@/server/api-response";

export const Route = createFileRoute("/api/v1/media-sources/$id/sync")({
  server: {
    handlers: {
      POST: async ({ params }) => {
        const { syncMediaSource } = await import("@/server/media-sync.server");
        const result = await syncMediaSource(params.id);
        return jsonSuccess(result);
      },
    },
  },
});
