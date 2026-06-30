import { createFileRoute } from "@tanstack/react-router";
import { jsonError, jsonSuccess, readJsonBody } from "@/server/api-response";

export const Route = createFileRoute("/api/v1/podcasts/$id")({
  server: {
    handlers: {
      GET: async ({ params }) => {
        const { findPodcastById } = await import("@/server/repositories/podcasts.repository");
        const podcast = await findPodcastById(params.id);
        if (!podcast) return jsonError("Podcast not found", "PODCAST_NOT_FOUND", 404);
        return jsonSuccess(podcast);
      },
      PATCH: async ({ request, params }) => {
        const body = await readJsonBody(request);
        const { updatePodcast } = await import("@/server/repositories/podcasts.repository");
        const podcast = await updatePodcast(params.id, {
          ...(typeof body.title === "string" ? { title: body.title } : {}),
          ...(typeof body.description === "string" ? { description: body.description } : {}),
          ...(typeof body.author === "string" ? { author: body.author } : {}),
          ...(typeof body.imageUrl === "string" ? { imageUrl: body.imageUrl } : {}),
          ...(typeof body.rssUrl === "string" ? { rssUrl: body.rssUrl } : {}),
          ...(typeof body.status === "string" ? { status: body.status } : {}),
        });
        if (!podcast) return jsonError("Podcast not found", "PODCAST_NOT_FOUND", 404);
        return jsonSuccess(podcast);
      },
    },
  },
});
