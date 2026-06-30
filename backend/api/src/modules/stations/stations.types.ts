export type StationStatus = "active" | "inactive";

export interface Station {
  name: string;
  slug: string;
  description?: string;
  logoUrl?: string;
  streamUrl?: string;
  timezone?: string;
  status: StationStatus;
  /** Legacy field from the original bootstrap seed; kept optional. */
  apiDomain?: string;
  createdAt?: Date;
  updatedAt?: Date;
}

export interface CreateStationInput {
  name: string;
  slug: string;
  description?: string;
  logoUrl?: string;
  streamUrl?: string;
  timezone?: string;
  status?: StationStatus;
}

export interface UpdateStationInput {
  name?: string;
  slug?: string;
  description?: string;
  logoUrl?: string;
  streamUrl?: string;
  timezone?: string;
  status?: StationStatus;
}
