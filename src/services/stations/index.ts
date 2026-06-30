import { apiClient } from "@/lib/api";
import { database, SUPABASE_ENABLED } from "@/services/database";
import type { SourcedResult } from "@/services/data-source";

export interface Station {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  is_active: boolean;
  logo_url: string | null;
  accent_color: string | null;
  slogan: string | null;
  public_url: string | null;
}

interface ApiEnvelope<T> {
  data: T;
  source: "radio-core";
}

function fromSupabase(row: {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  is_active: boolean;
}): Station {
  const optional = row as typeof row & {
    logo_url?: string | null;
    accent_color?: string | null;
    slogan?: string | null;
    public_url?: string | null;
  };
  return {
    ...row,
    logo_url: optional.logo_url ?? null,
    accent_color: optional.accent_color ?? null,
    slogan: optional.slogan ?? null,
    public_url: optional.public_url ?? null,
  };
}

async function listFromSupabase(reason: string): Promise<SourcedResult<Station[]>> {
  if (!SUPABASE_ENABLED) {
    return { data: [], source: "none", fallback: false, fallbackReason: reason };
  }
  const { data, error } = await database
    .from("stations")
    .select("id,name,slug,description,is_active")
    .order("name");
  if (error) throw error;
  return {
    data: (data ?? []).map(fromSupabase),
    source: "supabase",
    fallback: true,
    fallbackReason: reason,
  };
}

export async function listStations(): Promise<SourcedResult<Station[]>> {
  const response = await apiClient.get<ApiEnvelope<Station[]>>("/api/stations");
  if (Array.isArray(response.data?.data) && !response.error) {
    return { data: response.data.data, source: "radio-core", fallback: false };
  }
  return listFromSupabase(response.error ?? `Radio Core returned HTTP ${response.status}`);
}

export async function getStation(id: string): Promise<SourcedResult<Station | null>> {
  const response = await apiClient.get<ApiEnvelope<Station>>(
    `/api/stations/${encodeURIComponent(id)}`,
  );
  if (response.data?.data && !response.error) {
    return { data: response.data.data, source: "radio-core", fallback: false };
  }
  if (!SUPABASE_ENABLED) {
    return {
      data: null,
      source: "none",
      fallback: false,
      fallbackReason: response.error ?? `Radio Core returned HTTP ${response.status}`,
    };
  }
  const { data, error } = await database
    .from("stations")
    .select("id,name,slug,description,is_active")
    .eq("id", id)
    .maybeSingle();
  if (error) throw error;
  return {
    data: data ? fromSupabase(data) : null,
    source: "supabase",
    fallback: true,
    fallbackReason: response.error ?? `Radio Core returned HTTP ${response.status}`,
  };
}
