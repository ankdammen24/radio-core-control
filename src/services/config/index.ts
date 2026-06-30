import { apiClient } from "@/lib/api";
import { database, SUPABASE_ENABLED } from "@/services/database";
import type { SourcedResult } from "@/services/data-source";

export interface PublicConfig {
  product_name?: string;
  default_station_slug?: string;
  public_site_url?: string;
  listen_url?: string;
  support_email?: string;
  features?: Record<string, boolean>;
  [key: string]: unknown;
}

interface ApiEnvelope<T> {
  data: T;
  source: "radio-core";
}

export async function getPublicConfig(): Promise<SourcedResult<PublicConfig>> {
  const response = await apiClient.get<ApiEnvelope<PublicConfig>>("/api/config/public");
  if (response.data?.data && !response.error) {
    return { data: response.data.data, source: "radio-core", fallback: false };
  }

  if (!SUPABASE_ENABLED) {
    return {
      data: {},
      source: "none",
      fallback: false,
      fallbackReason: response.error ?? `Radio Core returned HTTP ${response.status}`,
    };
  }

  const { data, error } = await database
    .from("system_settings")
    .select("value")
    .eq("key", "public")
    .maybeSingle();
  if (error) throw error;
  return {
    data: data?.value && typeof data.value === "object" ? (data.value as PublicConfig) : {},
    source: "supabase",
    fallback: true,
    fallbackReason: response.error ?? `Radio Core returned HTTP ${response.status}`,
  };
}
