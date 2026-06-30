import { pgTable, text, integer, boolean, timestamp, uuid } from "drizzle-orm/pg-core";

export type MediaSourceKind = "fablesh" | "rss";
export type MediaSourceContentType = "music" | "podcast";

export const mediaSources = pgTable("media_sources", {
  id:             uuid("id").primaryKey().defaultRandom(),
  name:           text("name").notNull(),
  kind:           text("kind").notNull().default("fablesh"),
  contentType:    text("content_type").notNull(),
  baseUrl:        text("base_url").notNull(),
  authSecretName: text("auth_secret_name"),
  isActive:       boolean("is_active").notNull().default(true),
  lastSyncedAt:   timestamp("last_synced_at", { withTimezone: true }),
  createdAt:      timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt:      timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export type MediaSource = typeof mediaSources.$inferSelect;
export type NewMediaSource = typeof mediaSources.$inferInsert;

export const syncRuns = pgTable("sync_runs", {
  id:            uuid("id").primaryKey().defaultRandom(),
  sourceId:      uuid("source_id").notNull(),
  status:        text("status").notNull().default("running"),
  startedAt:     timestamp("started_at", { withTimezone: true }).notNull().defaultNow(),
  finishedAt:    timestamp("finished_at", { withTimezone: true }),
  itemsSeen:     integer("items_seen").notNull().default(0),
  itemsNew:      integer("items_new").notNull().default(0),
  itemsUpdated:  integer("items_updated").notNull().default(0),
  itemsDeleted:  integer("items_deleted").notNull().default(0),
  error:         text("error"),
});

export type SyncRun = typeof syncRuns.$inferSelect;
export type NewSyncRun = typeof syncRuns.$inferInsert;
