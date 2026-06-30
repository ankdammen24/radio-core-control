import { createFileRoute } from "@tanstack/react-router";
import { jsonError, jsonSuccess, readJsonBody } from "@/server/api-response";

export const Route = createFileRoute("/api/v1/podcasts")({
  server: {
    handlers: {
      GET: async () => {
        const { listPodcasts } = await import("@/server/repositories/podcasts.repository");
        const podcasts = await listPodcasts();
        return jsonSuccess(podcasts);
      },
      POST: async ({ request }) => {
        const body = await readJsonBody(request);
        const title = typeof body.title === "string" ? body.title.trim() : "";
        if (!title) return jsonError("title is required", "VALIDATION_ERROR");
        const { createPodcast } = await import("@/server/repositories/podcasts.repository");
        const podcast = await createPodcast({
          title,
          description: typeof body.description === "string" ? body.description : undefined,
          author: typeof body.author === "string" ? body.author : undefined,
          imageUrl: typeof body.imageUrl === "string" ? body.imageUrl : undefined,
          rssUrl: typeof body.rssUrl === "string" ? body.rssUrl : undefined,
          status: typeof body.status === "string" ? body.status : undefined,
        });
        return jsonSuccess(podcast, 201);
      },
    },
  },
});
