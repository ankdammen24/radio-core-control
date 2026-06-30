import type { Collection, Db } from "mongodb";

export interface PublicSystemConfig {
  product_name: string;
  default_station_slug: string;
  public_site_url: string;
  listen_url: string;
  support_email: string;
  features: Record<string, boolean>;
}

export interface SystemConfigDocument {
  key: "public" | string;
  value: PublicSystemConfig | Record<string, unknown>;
  is_public: boolean;
  created_at: Date;
  updated_at: Date;
}

export const SYSTEM_CONFIG_COLLECTION = "system_config";

export function systemConfigCollection(db: Db): Collection<SystemConfigDocument> {
  return db.collection<SystemConfigDocument>(SYSTEM_CONFIG_COLLECTION);
}
