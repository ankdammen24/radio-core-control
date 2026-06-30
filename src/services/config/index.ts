import { getGlobalSettings } from "@/services/settingsApi";
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

export async function getPublicConfig(): Promise<SourcedResult<PublicConfig>> {
  try {
    const values = await getGlobalSettings();
    return { data: values as PublicConfig, source: "radio-core", fallback: false };
  } catch (error) {
    return {
      data: {},
      source: "none",
      fallback: false,
      fallbackReason: error instanceof Error ? error.message : "Radio Core Backend is unavailable",
    };
  }
}
