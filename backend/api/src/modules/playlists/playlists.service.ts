import { AppError } from "../../core/app-error.js";
import type { PlaylistRepository } from "./playlists.repository.js";
import type { CreatePlaylistInput } from "./playlists.types.js";

export class PlaylistService {
  constructor(private readonly repository: PlaylistRepository) {}

  async listPlaylists() {
    return this.repository.findAll();
  }

  async getPlaylist(id: string) {
    const playlist = await this.repository.findById(id);
    if (!playlist) {
      throw AppError.notFound(`Playlist ${id} not found`, "PLAYLIST_NOT_FOUND");
    }
    return playlist;
  }

  async createPlaylist(input: CreatePlaylistInput) {
    const now = new Date();
    return this.repository.insertOne({
      ...input,
      items: [],
      status: input.status ?? "active",
      createdAt: now,
      updatedAt: now,
    });
  }

  async addMediaToPlaylist(playlistId: string, mediaId: string) {
    const updated = await this.repository.addItem(playlistId, { mediaId, addedAt: new Date() });
    if (!updated) {
      throw AppError.notFound(`Playlist ${playlistId} not found`, "PLAYLIST_NOT_FOUND");
    }
    return updated;
  }

  async removeMediaFromPlaylist(playlistId: string, mediaId: string) {
    const updated = await this.repository.removeItem(playlistId, mediaId);
    if (!updated) {
      throw AppError.notFound(`Playlist ${playlistId} not found`, "PLAYLIST_NOT_FOUND");
    }
    return updated;
  }
}
