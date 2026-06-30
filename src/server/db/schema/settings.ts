import { pgTable, text, jsonb, timestamp, uuid } from "drizzle-orm/pg-core";

/** Matches the original Supabase `system_settings` key/value table. */
export const systemSettings = pgTable("system_settings", {
  id:        uuid("id").primaryKey().defaultRandom(),
  key:       text("key").notNull().unique(),
  value:     jsonb("value").notNull().default({}),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export type SystemSetting = typeof systemSettings.$inferSelect;
export type NewSystemSetting = typeof systemSettings.$inferInsert;
