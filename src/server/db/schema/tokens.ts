import { pgTable, text, boolean, timestamp, uuid } from "drizzle-orm/pg-core";

export const stackTokens = pgTable("stack_tokens", {
  id:          uuid("id").primaryKey().defaultRandom(),
  name:        text("name").notNull(),
  tokenHash:   text("token_hash").notNull().unique(),
  purpose:     text("purpose").notNull().default("runner"),
  stationId:   uuid("station_id"),
  isActive:    boolean("is_active").notNull().default(true),
  lastUsedAt:  timestamp("last_used_at", { withTimezone: true }),
  revokedAt:   timestamp("revoked_at", { withTimezone: true }),
  createdAt:   timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export type StackToken = typeof stackTokens.$inferSelect;
export type NewStackToken = typeof stackTokens.$inferInsert;
