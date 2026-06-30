import { ObjectId, type Filter, type UpdateFilter, type WithId } from "mongodb";
import { BaseRepository } from "../../repositories/base.repository.js";
import type { Playlist, PlaylistItem } from "./playlists.types.js";

export class PlaylistRepository extends BaseRepository<Playlist> {
  constructor() {
    super("playlists");
  }

  async addItem(playlistId: string, item: PlaylistItem): Promise<WithId<Playlist> | null> {
    if (!ObjectId.isValid(playlistId)) return null;
    const collection = await this.collection();
    return collection.findOneAndUpdate(
      { _id: new ObjectId(playlistId) } as Filter<Playlist>,
      {
        $push: { items: item },
        $set: { updatedAt: new Date() },
      } as unknown as UpdateFilter<Playlist>,
      { returnDocument: "after" },
    );
  }

  async removeItem(playlistId: string, mediaId: string): Promise<WithId<Playlist> | null> {
    if (!ObjectId.isValid(playlistId)) return null;
    const collection = await this.collection();
    return collection.findOneAndUpdate(
      { _id: new ObjectId(playlistId) } as Filter<Playlist>,
      {
        $pull: { items: { mediaId } },
        $set: { updatedAt: new Date() },
      } as unknown as UpdateFilter<Playlist>,
      { returnDocument: "after" },
    );
  }
}
