export type DataSource = "radio-core" | "supabase" | "none";

export interface SourcedResult<T> {
  data: T;
  source: DataSource;
  fallback: boolean;
  fallbackReason?: string;
}
