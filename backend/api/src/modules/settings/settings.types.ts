export type SettingsScope = "global" | "station";

export interface SettingsDocument {
  scope: SettingsScope;
  stationId?: string;
  values: Record<string, unknown>;
  updatedAt?: Date;
}
