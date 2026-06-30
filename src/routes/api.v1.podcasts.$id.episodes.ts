import { createFileRoute } from "@tanstack/react-router";
import { jsonError, jsonSuccess, readJsonBody } from "@/server/api-response";

export const Route = createFileRoute("/api/v1/podcasts/$id/episodes")({
  server: {
    handlers: {
      GET: async ({ params }) => {
        const { findPodcastById, listEpisodes } = await import(
          "@/server/repositories/podcasts.repository"
        );
        const podcast = await findPodcastById(params.id);
        if (!podcast) return jsonError("Podcast not found", "PODCAST_NOT_FOUND", 404);
        const episodes = await listEpisodes(params.id);
        return jsonSuccess(episodes);
      },
      POST: async ({ request, params }) => {
        const body = await readJsonBody(request);
        const title = typeof body.title === "string" ? body.title.trim() : "";
        if (!title) return jsonError("title is required", "VALIDATION_ERROR");
        const { findPodcastById, createEpisode } = await import(
          "@/server/repositories/podcasts.repository"
        );
        const podcast = await findPodcastById(params.id);
        if (!podcast) return jsonError("Podcast not found", "PODCAST_NOT_FOUND", 404);
        const episode = await createEpisode({
          podcastId: params.id,
          title,
          description: typeof body.description === "string" ? body.description : undefined,
          audioUrl: typeof body.audioUrl === "string" ? body.audioUrl : undefined,
          durationSeconds: typeof body.durationSeconds === "number" ? body.durationSeconds : undefined,
          publishedAt: typeof body.publishedAt === "string" ? new Date(body.publishedAt) : undefined,
          status: typeof body.status === "string" ? body.status : undefined,
        });
        return jsonSuccess(episode, 201);
      },
    },
  },
});
