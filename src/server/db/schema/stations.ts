import { pgTable, text, boolean, timestamp, uuid } from "drizzle-orm/pg-core";

export const stations = pgTable("stations", {
  id:                   uuid("id").primaryKey().defaultRandom(),
  slug:                 text("slug").notNull().unique(),
  name:                 text("name").notNull(),
  description:          text("description"),
  accountId:            uuid("account_id"),
  isActive:             boolean("is_active").notNull().default(true),
  demoMode:             boolean("demo_mode").notNull().default(false),
  demoStreamUrl:        text("demo_stream_url"),
  demoArtworkUrl:       text("demo_artwork_url"),
  azuracastStationId:   text("azuracast_station_id"),
  apiKeyHash:           text("api_key_hash"),
  apiKeyPrefix:         text("api_key_prefix"),
  createdAt:            timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt:            timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export type Station = typeof stations.$inferSelect;
export type NewStation = typeof stations.$inferInsert;
