import {
  pgTable, text, integer, boolean, timestamp, uuid, real,
} from "drizzle-orm/pg-core";

// ─── scheduler_categories ─────────────────────────────────────────────────────
// Music categories used for rotation (e.g. "Gold", "Current", "Hot AC")
export const schedulerCategories = pgTable("scheduler_categories", {
  id:          uuid("id").primaryKey().defaultRandom(),
  stationId:   uuid("station_id").notNull(),
  name:        text("name").notNull(),
  description: text("description"),
  color:       text("color"),
  priority:    integer("priority").notNull().default(1),
  isActive:    boolean("is_active").notNull().default(true),
  createdAt:   timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt:   timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});
export type SchedulerCategory = typeof schedulerCategories.$inferSelect;

// ─── scheduler_rotations ──────────────────────────────────────────────────────
// Assigns a media file to a category with a relative weight for weighted random
export const schedulerRotations = pgTable("scheduler_rotations", {
  id:          uuid("id").primaryKey().defaultRandom(),
  categoryId:  uuid("category_id").notNull(),
  mediaFileId: uuid("media_file_id").notNull(),
  weight:      integer("weight").notNull().default(1),
  isActive:    boolean("is_active").notNull().default(true),
  createdAt:   timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});
export type SchedulerRotation = typeof schedulerRotations.$inferSelect;

// ─── scheduler_clocks ─────────────────────────────────────────────────────────
// A named clock template (e.g. "Weekday Daytime", "Weekend Evening")
export const schedulerClocks = pgTable("scheduler_clocks", {
  id:          uuid("id").primaryKey().defaultRandom(),
  stationId:   uuid("station_id").notNull(),
  name:        text("name").notNull(),
  description: text("description"),
  isDefault:   boolean("is_default").notNull().default(false),
  isActive:    boolean("is_active").notNull().default(true),
  createdAt:   timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt:   timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});
export type SchedulerClock = typeof schedulerClocks.$inferSelect;

// ─── scheduler_clock_hours ────────────────────────────────────────────────────
// Maps (day_of_week, hour) to a clock so we know which clock is active when
export const schedulerClockHours = pgTable("scheduler_clock_hours", {
  id:         uuid("id").primaryKey().defaultRandom(),
  clockId:    uuid("clock_id").notNull(),
  stationId:  uuid("station_id").notNull(),
  dayOfWeek:  integer("day_of_week").notNull(), // 0=Sun … 6=Sat; -1 = every day
  hour:       integer("hour").notNull(),         // 0–23
  createdAt:  timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});
export type SchedulerClockHour = typeof schedulerClockHours.$inferSelect;

// ─── scheduler_clock_items ────────────────────────────────────────────────────
// The ordered items within a clock (what plays at each minute mark)
export const schedulerClockItems = pgTable("scheduler_clock_items", {
  id:            uuid("id").primaryKey().defaultRandom(),
  clockId:       uuid("clock_id").notNull(),
  position:      integer("position").notNull(),      // sort order
  minuteOffset:  integer("minute_offset").notNull(), // 0–59 — when in the hour this fires
  // itemType drives the selection algorithm
  itemType:      text("item_type").notNull().default("music"),
  // itemType values: music | playlist | category | jingle | commercial | news | live | silence | fallback
  categoryId:    uuid("category_id"),   // used when itemType = category
  playlistId:    uuid("playlist_id"),   // used when itemType = playlist
  selectionMode: text("selection_mode").notNull().default("weighted_random"),
  // selectionMode values: random | sequential | weighted_random
  estimatedDurationSeconds: integer("estimated_duration_seconds"),
  label:         text("label"),   // human-readable e.g. "Music", "News Break"
  isEnabled:     boolean("is_enabled").notNull().default(true),
  createdAt:     timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt:     timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});
export type SchedulerClockItem = typeof schedulerClockItems.$inferSelect;

// ─── scheduler_rules ──────────────────────────────────────────────────────────
// Separation and duration rules applied during track selection
export const schedulerRules = pgTable("scheduler_rules", {
  id:        uuid("id").primaryKey().defaultRandom(),
  stationId: uuid("station_id").notNull(),
  // ruleType values: artist_separation | title_separation | min_duration | max_duration
  ruleType:  text("rule_type").notNull(),
  // For separation rules: value = minutes. For duration rules: value = seconds.
  value:     real("value").notNull(),
  isEnabled: boolean("is_enabled").notNull().default(true),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});
export type SchedulerRule = typeof schedulerRules.$inferSelect;

// ─── scheduler_history ────────────────────────────────────────────────────────
// Log of every scheduling decision — used to enforce separation rules
export const schedulerHistory = pgTable("scheduler_history", {
  id:          uuid("id").primaryKey().defaultRandom(),
  stationId:   uuid("station_id").notNull(),
  mediaFileId: uuid("media_file_id"),
  itemType:    text("item_type").notNull(),
  artist:      text("artist"),
  title:       text("title"),
  durationSeconds: real("duration_seconds"),
  clockId:     uuid("clock_id"),
  clockItemId: uuid("clock_item_id"),
  reason:      text("reason"),
  scheduledAt: timestamp("scheduled_at", { withTimezone: true }).notNull().defaultNow(),
});
export type SchedulerHistoryEntry = typeof schedulerHistory.$inferSelect;
