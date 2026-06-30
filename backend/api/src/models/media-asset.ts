import type { Collection, Db } from "mongodb";

export type MediaAssetStatus = "pending" | "processing" | "ready" | "error" | "missing_metadata";

export interface MediaAssetDocument {
  id: string;
  station_id: string;
  file_name: string;
  asset_type: "music" | "jingle" | "ad" | "news" | "podcast" | "voicetrack";
  status: MediaAssetStatus;
  playback_url: string | null;
  duration_seconds: number | null;
  created_at: Date;
  updated_at: Date;
}

export const MEDIA_ASSETS_COLLECTION = "media_assets";

export function mediaAssetsCollection(db: Db): Collection<MediaAssetDocument> {
  return db.collection<MediaAssetDocument>(MEDIA_ASSETS_COLLECTION);
}
