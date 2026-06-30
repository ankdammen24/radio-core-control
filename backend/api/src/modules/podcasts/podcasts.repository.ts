import type { Filter } from "mongodb";
import { BaseRepository } from "../../repositories/base.repository.js";
import type { Episode, Podcast } from "./podcasts.types.js";

export class PodcastRepository extends BaseRepository<Podcast> {
  constructor() {
    super("podcasts");
  }
}

export class EpisodeRepository extends BaseRepository<Episode> {
  constructor() {
    super("podcast_episodes");
  }

  async findByPodcastId(podcastId: string) {
    return this.findAll({ podcastId } as Filter<Episode>);
  }
}
