import { pgTable, text, timestamp, uuid, jsonb } from "drizzle-orm/pg-core";

// agent_status is a PostgreSQL enum in the DB; Drizzle reads it as text.
// Values: 'online' | 'offline' | 'unknown'

export const agentInstances = pgTable("agent_instances", {
  id:                 uuid("id").primaryKey().defaultRandom(),
  name:               text("name").notNull(),
  stationId:          uuid("station_id"),
  stackTokenId:       uuid("stack_token_id"),
  hostname:           text("hostname"),
  version:            text("version"),
  status:             text("status").notNull().default("unknown"),
  lastSeenAt:         timestamp("last_seen_at", { withTimezone: true }),
  lastError:          text("last_error"),
  capabilities:       jsonb("capabilities").notNull().default({}),
  metrics:            jsonb("metrics").notNull().default({}),
  metadata:           jsonb("metadata").notNull().default({}),
  reloadRequestedAt:  timestamp("reload_requested_at", { withTimezone: true }),
  createdAt:          timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt:          timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export type AgentInstance = typeof agentInstances.$inferSelect;
export type NewAgentInstance = typeof agentInstances.$inferInsert;
