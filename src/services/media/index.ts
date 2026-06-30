import { listMedia } from "@/services/mediaApi";
import type { SourcedResult } from "@/services/data-source";

export interface MediaStatus {
  total: number;
  ready: number;
  pending: number;
  processing: number;
  error: number;
  missing_metadata: number;
  by_status: Record<string, number>;
}

const EMPTY_MEDIA_STATUS: MediaStatus = {
  total: 0,
  ready: 0,
  pending: 0,
  processing: 0,
  error: 0,
  missing_metadata: 0,
  by_status: {},
};

/**
 * The Radio Core API models media lifecycle as active/archived only — the
 * richer ingestion-pipeline states (imported/missing_metadata/processing/etc.)
 * from the old Supabase schema aren't modeled yet. `ready` reflects active
 * media; pending/processing/error/missing_metadata are always 0 until a
 * processing pipeline exists.
 *
 * `stationId` is accepted for call-site compatibility but not yet applied —
 * the Media module has no stationId field in the backend yet.
 */
export async function getMediaStatus(_stationId?: string | null): Promise<SourcedResult<MediaStatus>> {
  try {
    const media = await listMedia();
    const active = media.filter((m) => m.status === "active").length;
    const archived = media.filter((m) => m.status === "archived").length;
    return {
      data: {
        ...EMPTY_MEDIA_STATUS,
        total: media.length,
        ready: active,
        by_status: { active, archived },
      },
      source: "radio-core",
      fallback: false,
    };
  } catch (error) {
    return {
      data: EMPTY_MEDIA_STATUS,
      source: "none",
      fallback: false,
      fallbackReason: error instanceof Error ? error.message : "Radio Core Backend is unavailable",
    };
  }
}
