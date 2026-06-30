import { AppError } from "../../core/app-error.js";
import type { EpisodeRepository, PodcastRepository } from "./podcasts.repository.js";
import type { CreateEpisodeInput, CreatePodcastInput, UpdatePodcastInput } from "./podcasts.types.js";

export class PodcastService {
  constructor(
    private readonly podcasts: PodcastRepository,
    private readonly episodes: EpisodeRepository,
  ) {}

  async listPodcasts() {
    return this.podcasts.findAll();
  }

  async getPodcast(id: string) {
    const podcast = await this.podcasts.findById(id);
    if (!podcast) {
      throw AppError.notFound(`Podcast ${id} not found`, "PODCAST_NOT_FOUND");
    }
    return podcast;
  }

  async createPodcast(input: CreatePodcastInput) {
    const now = new Date();
    return this.podcasts.insertOne({
      ...input,
      status: input.status ?? "active",
      createdAt: now,
      updatedAt: now,
    });
  }

  async updatePodcast(id: string, input: UpdatePodcastInput) {
    const updated = await this.podcasts.updateById(id, input);
    if (!updated) {
      throw AppError.notFound(`Podcast ${id} not found`, "PODCAST_NOT_FOUND");
    }
    return updated;
  }

  async createEpisode(podcastId: string, input: CreateEpisodeInput) {
    await this.getPodcast(podcastId);
    const now = new Date();
    return this.episodes.insertOne({
      podcastId,
      title: input.title,
      description: input.description,
      audioUrl: input.audioUrl,
      duration: input.duration,
      publishedAt: input.publishedAt ? new Date(input.publishedAt) : undefined,
      status: input.status ?? "draft",
      createdAt: now,
      updatedAt: now,
    });
  }

  async listEpisodes(podcastId: string) {
    await this.getPodcast(podcastId);
    return this.episodes.findByPodcastId(podcastId);
  }
}
