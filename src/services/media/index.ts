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
 * `stationId` is accepted for call-site compatibility; once set it filters
 * client-side since the API does not yet expose a station-scoped query param.
 */
export async function getMediaStatus(stationId?: string | null): Promise<SourcedResult<MediaStatus>> {
  try {
    const all = await listMedia();
    const media = stationId ? all.filter((m) => m.stationId === stationId) : all;
    const byStatus: Record<string, number> = {};
    for (const m of media) {
      byStatus[m.status] = (byStatus[m.status] ?? 0) + 1;
    }
    return {
      data: {
        total: media.length,
        ready: byStatus.ready ?? 0,
        pending: byStatus.imported ?? 0,
        processing: byStatus.paused ?? 0,
        error: byStatus.error ?? 0,
        missing_metadata: byStatus.missing_metadata ?? 0,
        by_status: byStatus,
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
