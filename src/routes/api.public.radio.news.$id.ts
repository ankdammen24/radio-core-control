/**
 * Radio Core integration API — fetch a single news item by id.
 * Auth: `Authorization: Bearer <station-api-key>`.
 */
import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/api/public/radio/news/$id")({
  server: {
    handlers: {
      GET: async ({ request, params }) => {
        const { authenticateStationByKey } = await import("@/server/station-api-auth.server");
        const auth = await authenticateStationByKey(request);
        if (!auth.ok) return Response.json({ error: auth.message }, { status: auth.status });

        const { adminDatabase } = await import("@/services/database/server");
        const { data, error } = await adminDatabase
          .from("news_items").select("*").eq("id", params.id).maybeSingle();
        if (error) return Response.json({ error: error.message }, { status: 500 });
        if (!data) return Response.json({ error: "Not found" }, { status: 404 });
        if (!["ready_for_radio", "broadcasted"].includes(data.status)) {
          return Response.json({ error: "Item not available for radio" }, { status: 403 });
        }

        const { mapNewsItem } = await import("@/server/news-mapper.server");
        return Response.json({ station: auth.station, item: mapNewsItem(data) });
      },
    },
  },
});
