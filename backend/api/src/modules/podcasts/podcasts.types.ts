export type PodcastStatus = "active" | "inactive";
export type EpisodeStatus = "draft" | "published";

export interface Podcast {
  title: string;
  description?: string;
  author?: string;
  imageUrl?: string;
  rssUrl?: string;
  status: PodcastStatus;
  createdAt?: Date;
  updatedAt?: Date;
}

export interface CreatePodcastInput {
  title: string;
  description?: string;
  author?: string;
  imageUrl?: string;
  rssUrl?: string;
  status?: PodcastStatus;
}

export interface UpdatePodcastInput {
  title?: string;
  description?: string;
  author?: string;
  imageUrl?: string;
  rssUrl?: string;
  status?: PodcastStatus;
}

export interface Episode {
  podcastId: string;
  title: string;
  description?: string;
  audioUrl?: string;
  duration?: number;
  publishedAt?: Date;
  status: EpisodeStatus;
  createdAt?: Date;
  updatedAt?: Date;
}

export interface CreateEpisodeInput {
  title: string;
  description?: string;
  audioUrl?: string;
  duration?: number;
  publishedAt?: string;
  status?: EpisodeStatus;
}
