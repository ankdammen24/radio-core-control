/**
 * Settings repository — Drizzle ORM (key/value, matches original system_settings table)
 */
import { eq } from "drizzle-orm";
import { db } from "@/server/db/client";
import { systemSettings } from "@/server/db/schema";

const GLOBAL_KEY = "global";

function stationKey(stationId: string): string {
  return `station:${stationId}`;
}

export async function getSettingsByKey(key: string): Promise<Record<string, unknown>> {
  const rows = await db.select().from(systemSettings).where(eq(systemSettings.key, key)).limit(1);
  return (rows[0]?.value as Record<string, unknown>) ?? {};
}

export async function upsertSettingsByKey(
  key: string,
  value: Record<string, unknown>,
): Promise<Record<string, unknown>> {
  const rows = await db
    .insert(systemSettings)
    .values({ key, value, updatedAt: new Date() })
    .onConflictDoUpdate({
      target: systemSettings.key,
      set: { value, updatedAt: new Date() },
    })
    .returning();
  return rows[0].value as Record<string, unknown>;
}

export const getGlobalSettings = () => getSettingsByKey(GLOBAL_KEY);
export const upsertGlobalSettings = (value: Record<string, unknown>) =>
  upsertSettingsByKey(GLOBAL_KEY, value);
export const getStationSettings = (stationId: string) => getSettingsByKey(stationKey(stationId));
export const upsertStationSettings = (stationId: string, value: Record<string, unknown>) =>
  upsertSettingsByKey(stationKey(stationId), value);
