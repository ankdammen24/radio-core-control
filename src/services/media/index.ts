import { apiClient } from "@/lib/api";
import { database, SUPABASE_ENABLED } from "@/services/database";
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

interface ApiEnvelope<T> {
  data: T;
  source: "radio-core";
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

export async function getMediaStatus(
  stationId?: string | null,
): Promise<SourcedResult<MediaStatus>> {
  const query = stationId ? `?station_id=${encodeURIComponent(stationId)}` : "";
  const response = await apiClient.get<ApiEnvelope<MediaStatus>>(`/api/media/status${query}`, {
    cache: "no-store",
  });
  if (response.data?.data && !response.error) {
    return { data: response.data.data, source: "radio-core", fallback: false };
  }

  if (!SUPABASE_ENABLED) {
    return {
      data: EMPTY_MEDIA_STATUS,
      source: "none",
      fallback: false,
      fallbackReason: response.error ?? `Radio Core returned HTTP ${response.status}`,
    };
  }

  const filter = <T extends { eq: (column: string, value: string) => T }>(builder: T) =>
    stationId ? builder.eq("station_id", stationId) : builder;
  const [total, ready, pending, processing, errors, missing] = await Promise.all([
    filter(database.from("media_files").select("*", { count: "exact", head: true })),
    filter(
      database
        .from("media_files")
        .select("*", { count: "exact", head: true })
        .eq("status", "ready"),
    ),
    filter(
      database
        .from("media_files")
        .select("*", { count: "exact", head: true })
        .eq("status", "imported"),
    ),
    filter(
      database
        .from("media_files")
        .select("*", { count: "exact", head: true })
        .eq("status", "paused"),
    ),
    filter(
      database
        .from("media_files")
        .select("*", { count: "exact", head: true })
        .eq("status", "error"),
    ),
    filter(
      database
        .from("media_files")
        .select("*", { count: "exact", head: true })
        .eq("status", "missing_metadata"),
    ),
  ]);
  const firstError = [total, ready, pending, processing, errors, missing].find(
    ({ error }) => error,
  )?.error;
  if (firstError) throw firstError;
  const data: MediaStatus = {
    total: total.count ?? 0,
    ready: ready.count ?? 0,
    pending: pending.count ?? 0,
    processing: processing.count ?? 0,
    error: errors.count ?? 0,
    missing_metadata: missing.count ?? 0,
    by_status: {},
  };
  data.by_status = {
    ready: data.ready,
    pending: data.pending,
    processing: data.processing,
    error: data.error,
    missing_metadata: data.missing_metadata,
  };
  return {
    data,
    source: "supabase",
    fallback: true,
    fallbackReason: response.error ?? `Radio Core returned HTTP ${response.status}`,
  };
}
