import { pgTable, text, integer, timestamp, uuid, jsonb } from "drizzle-orm/pg-core";

// ─── service_health ────────────────────────────────────────────────────────────
export const serviceHealth = pgTable("service_health", {
  id:         uuid("id").primaryKey().defaultRandom(),
  stationId:  uuid("station_id"),
  service:    text("service").notNull(),
  status:     text("status").notNull().default("unknown"),
  message:    text("message"),
  details:    jsonb("details"),
  reportedAt: timestamp("reported_at", { withTimezone: true }).notNull().defaultNow(),
});

export type ServiceHealth = typeof serviceHealth.$inferSelect;
export type NewServiceHealth = typeof serviceHealth.$inferInsert;

// ─── now_playing ──────────────────────────────────────────────────────────────
// PK is station_id (one row per station, upserted)
export const nowPlaying = pgTable("now_playing", {
  stationId:       uuid("station_id").primaryKey().notNull(),
  title:           text("title"),
  artist:          text("artist"),
  album:           text("album"),
  mountPath:       text("mount_path"),
  listeners:       integer("listeners").notNull().default(0),
  durationSeconds: integer("duration_seconds"),
  mediaFileId:     uuid("media_file_id"),
  startedAt:       timestamp("started_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt:       timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export type NowPlaying = typeof nowPlaying.$inferSelect;
export type NewNowPlaying = typeof nowPlaying.$inferInsert;

// ─── play_history ─────────────────────────────────────────────────────────────
export const playHistory = pgTable("play_history", {
  id:              uuid("id").primaryKey().defaultRandom(),
  stationId:       uuid("station_id").notNull(),
  title:           text("title"),
  artist:          text("artist"),
  album:           text("album"),
  listeners:       integer("listeners"),
  durationSeconds: integer("duration_seconds"),
  mediaFileId:     uuid("media_file_id"),
  playedAt:        timestamp("played_at", { withTimezone: true }).notNull().defaultNow(),
});

export type PlayHistory = typeof playHistory.$inferSelect;
export type NewPlayHistory = typeof playHistory.$inferInsert;

// ─── listener_stats ───────────────────────────────────────────────────────────
export const listenerStats = pgTable("listener_stats", {
  id:             uuid("id").primaryKey().defaultRandom(),
  stationId:      uuid("station_id").notNull(),
  mountPath:      text("mount_path"),
  listeners:      integer("listeners").notNull().default(0),
  peakListeners:  integer("peak_listeners").notNull().default(0),
  recordedAt:     timestamp("recorded_at", { withTimezone: true }).notNull().defaultNow(),
});

export type ListenerStat = typeof listenerStats.$inferSelect;
export type NewListenerStat = typeof listenerStats.$inferInsert;
