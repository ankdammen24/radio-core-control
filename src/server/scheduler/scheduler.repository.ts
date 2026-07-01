import { eq, and, desc, gte, sql } from "drizzle-orm";
import { db } from "@/server/db/client";
import {
  schedulerCategories, schedulerRotations, schedulerClocks,
  schedulerClockHours, schedulerClockItems, schedulerRules, schedulerHistory,
  mediaFiles, playlists, playlistAssignments,
} from "@/server/db/schema";

// ─── Clocks ───────────────────────────────────────────────────────────────────

export async function listClocks(stationId: string) {
  return db.select().from(schedulerClocks).where(eq(schedulerClocks.stationId, stationId));
}

export async function getClockById(id: string) {
  const rows = await db.select().from(schedulerClocks).where(eq(schedulerClocks.id, id)).limit(1);
  return rows[0] ?? null;
}

/** Find the active clock for a given station, day-of-week (0=Sun…6=Sat), and hour (0–23). */
export async function resolveActiveClock(stationId: string, dayOfWeek: number, hour: number) {
  // Prefer a specific day match over the "every day" wildcard (-1)
  const rows = await db
    .select({ clock: schedulerClocks, clockHour: schedulerClockHours })
    .from(schedulerClockHours)
    .innerJoin(schedulerClocks, eq(schedulerClocks.id, schedulerClockHours.clockId))
    .where(
      and(
        eq(schedulerClockHours.stationId, stationId),
        eq(schedulerClockHours.hour, hour),
        eq(schedulerClocks.isActive, true),
      ),
    );

  const specific = rows.find((r) => r.clockHour.dayOfWeek === dayOfWeek);
  if (specific) return specific.clock;

  const wildcard = rows.find((r) => r.clockHour.dayOfWeek === -1);
  if (wildcard) return wildcard.clock;

  // Fallback: station's default clock (ignoring hour assignment)
  const defaults = await db
    .select()
    .from(schedulerClocks)
    .where(and(eq(schedulerClocks.stationId, stationId), eq(schedulerClocks.isDefault, true), eq(schedulerClocks.isActive, true)))
    .limit(1);
  return defaults[0] ?? null;
}

export async function getClockItems(clockId: string) {
  return db
    .select()
    .from(schedulerClockItems)
    .where(and(eq(schedulerClockItems.clockId, clockId), eq(schedulerClockItems.isEnabled, true)))
    .orderBy(schedulerClockItems.position);
}

// ─── Rules ────────────────────────────────────────────────────────────────────

export async function getRules(stationId: string) {
  return db
    .select()
    .from(schedulerRules)
    .where(and(eq(schedulerRules.stationId, stationId), eq(schedulerRules.isEnabled, true)));
}

// ─── History ─────────────────────────────────────────────────────────────────

export async function getRecentHistory(stationId: string, sinceMinutes: number) {
  const since = new Date(Date.now() - sinceMinutes * 60 * 1000);
  return db
    .select()
    .from(schedulerHistory)
    .where(and(eq(schedulerHistory.stationId, stationId), gte(schedulerHistory.scheduledAt, since)))
    .orderBy(desc(schedulerHistory.scheduledAt))
    .limit(200);
}

export async function recordDecision(entry: {
  stationId: string;
  mediaFileId?: string;
  itemType: string;
  artist?: string;
  title?: string;
  durationSeconds?: number;
  clockId?: string;
  clockItemId?: string;
  reason: string;
}) {
  const rows = await db.insert(schedulerHistory).values({
    stationId: entry.stationId,
    mediaFileId: entry.mediaFileId ?? null,
    itemType: entry.itemType,
    artist: entry.artist ?? null,
    title: entry.title ?? null,
    durationSeconds: entry.durationSeconds ?? null,
    clockId: entry.clockId ?? null,
    clockItemId: entry.clockItemId ?? null,
    reason: entry.reason,
  }).returning();
  return rows[0];
}

// ─── Categories + Rotations ───────────────────────────────────────────────────

export async function listCategories(stationId: string) {
  return db
    .select()
    .from(schedulerCategories)
    .where(and(eq(schedulerCategories.stationId, stationId), eq(schedulerCategories.isActive, true)))
    .orderBy(schedulerCategories.priority);
}

export async function getCategoryById(id: string) {
  const rows = await db.select().from(schedulerCategories).where(eq(schedulerCategories.id, id)).limit(1);
  return rows[0] ?? null;
}

export async function getRotationMedia(categoryId: string) {
  return db
    .select({ rotation: schedulerRotations, media: mediaFiles })
    .from(schedulerRotations)
    .innerJoin(mediaFiles, eq(mediaFiles.id, schedulerRotations.mediaFileId))
    .where(and(eq(schedulerRotations.categoryId, categoryId), eq(schedulerRotations.isActive, true)));
}

// ─── Playlist items ───────────────────────────────────────────────────────────

export async function getPlaylistMedia(playlistId: string) {
  return db
    .select({ assignment: playlistAssignments, media: mediaFiles })
    .from(playlistAssignments)
    .innerJoin(mediaFiles, eq(mediaFiles.id, playlistAssignments.mediaFileId))
    .where(eq(playlistAssignments.playlistId, playlistId))
    .orderBy(playlistAssignments.weight);
}

// ─── Fallback media ───────────────────────────────────────────────────────────

export async function getAnyReadyMedia(stationId: string) {
  const rows = await db
    .select()
    .from(mediaFiles)
    .where(and(eq(mediaFiles.stationId, stationId), eq(mediaFiles.status, "ready")))
    .orderBy(sql`RANDOM()`)
    .limit(1);
  return rows[0] ?? null;
}

// ─── CRUD for clocks / categories / rules ─────────────────────────────────────

export async function createClock(input: {
  stationId: string;
  name: string;
  description?: string;
  isDefault?: boolean;
}) {
  const rows = await db.insert(schedulerClocks).values({
    stationId: input.stationId,
    name: input.name,
    description: input.description ?? null,
    isDefault: input.isDefault ?? false,
  }).returning();
  return rows[0];
}

export async function createClockItem(input: {
  clockId: string;
  position: number;
  minuteOffset: number;
  itemType: string;
  categoryId?: string;
  playlistId?: string;
  selectionMode?: string;
  estimatedDurationSeconds?: number;
  label?: string;
}) {
  const rows = await db.insert(schedulerClockItems).values({
    clockId: input.clockId,
    position: input.position,
    minuteOffset: input.minuteOffset,
    itemType: input.itemType,
    categoryId: input.categoryId ?? null,
    playlistId: input.playlistId ?? null,
    selectionMode: input.selectionMode ?? "weighted_random",
    estimatedDurationSeconds: input.estimatedDurationSeconds ?? null,
    label: input.label ?? null,
  }).returning();
  return rows[0];
}

export async function assignClockHour(input: {
  clockId: string;
  stationId: string;
  dayOfWeek: number;
  hour: number;
}) {
  const rows = await db.insert(schedulerClockHours).values(input).returning();
  return rows[0];
}

export async function createCategory(input: {
  stationId: string;
  name: string;
  description?: string;
  color?: string;
  priority?: number;
}) {
  const rows = await db.insert(schedulerCategories).values({
    stationId: input.stationId,
    name: input.name,
    description: input.description ?? null,
    color: input.color ?? null,
    priority: input.priority ?? 1,
  }).returning();
  return rows[0];
}

export async function addToRotation(input: {
  categoryId: string;
  mediaFileId: string;
  weight?: number;
}) {
  const rows = await db.insert(schedulerRotations).values({
    categoryId: input.categoryId,
    mediaFileId: input.mediaFileId,
    weight: input.weight ?? 1,
  }).returning();
  return rows[0];
}

export async function upsertRule(input: {
  stationId: string;
  ruleType: string;
  value: number;
}) {
  const existing = await db
    .select()
    .from(schedulerRules)
    .where(and(eq(schedulerRules.stationId, input.stationId), eq(schedulerRules.ruleType, input.ruleType)))
    .limit(1);

  if (existing[0]) {
    const rows = await db
      .update(schedulerRules)
      .set({ value: input.value, isEnabled: true, updatedAt: new Date() })
      .where(eq(schedulerRules.id, existing[0].id))
      .returning();
    return rows[0];
  }
  const rows = await db.insert(schedulerRules).values(input).returning();
  return rows[0];
}
