export type PlaylistStatus = "active" | "inactive";

export interface PlaylistItem {
  mediaId: string;
  addedAt: Date;
}

export interface Playlist {
  name: string;
  description?: string;
  stationId?: string;
  items: PlaylistItem[];
  status: PlaylistStatus;
  createdAt?: Date;
  updatedAt?: Date;
}

export interface CreatePlaylistInput {
  name: string;
  description?: string;
  stationId?: string;
  status?: PlaylistStatus;
}
