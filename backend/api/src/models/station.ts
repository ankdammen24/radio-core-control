import type { Collection, Db } from "mongodb";

export interface StationDocument {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  is_active: boolean;
  logo_url: string | null;
  accent_color: string | null;
  slogan: string | null;
  public_url: string | null;
  domain?: string;
  apiDomain?: string;
  status?: "active" | "inactive";
  created_at: Date;
  updated_at: Date;
}

export const STATIONS_COLLECTION = "stations";

export function stationsCollection(db: Db): Collection<StationDocument> {
  return db.collection<StationDocument>(STATIONS_COLLECTION);
}
