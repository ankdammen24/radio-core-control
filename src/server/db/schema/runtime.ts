/**
 * Drizzle schema — runtime_targets, audit_logs, system_events
 */
import { pgTable, text, boolean, timestamp, uuid, jsonb } from "drizzle-orm/pg-core";

// ─── runtime_targets ──────────────────────────────────────────────────────────
export const runtimeTargets = pgTable("runtime_targets", {
  id:                 uuid("id").primaryKey().defaultRandom(),
  stationId:          uuid("station_id").notNull(),
  name:               text("name").notNull(),
  type:               text("type").notNull().default("azuracast"),
  // runtime_target_type enum: azuracast | icecast | liquidsoap | custom
  baseUrl:            text("base_url"),
  apiKeySecretName:   text("api_key_secret_name"),
  externalStationId:  text("external_station_id"),
  status:             text("status").notNull().default("unknown"),
  // runtime_target_status enum: unknown | ok | degraded | down | error
  isActive:           boolean("is_active").notNull().default(true),
  lastCheckedAt:      timestamp("last_checked_at", { withTimezone: true }),
  lastError:          text("last_error"),
  metadata:           jsonb("metadata").notNull().default({}),
  createdAt:          timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt:          timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export type RuntimeTarget = typeof runtimeTargets.$inferSelect;
export type NewRuntimeTarget = typeof runtimeTargets.$inferInsert;

// ─── audit_logs ───────────────────────────────────────────────────────────────
export const auditLogs = pgTable("audit_logs", {
  id:          uuid("id").primaryKey().defaultRandom(),
  userId:      uuid("user_id"),          // null för systemhändelser
  stationId:   uuid("station_id"),
  action:      text("action").notNull(), // e.g. "agent.first_heartbeat"
  entityType:  text("entity_type"),      // e.g. "agent_instances"
  entityId:    uuid("entity_id"),
  oldValue:    jsonb("old_value"),
  newValue:    jsonb("new_value"),
  createdAt:   timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export type AuditLog = typeof auditLogs.$inferSelect;
export type NewAuditLog = typeof auditLogs.$inferInsert;

// ─── system_events ────────────────────────────────────────────────────────────
export const systemEvents = pgTable("system_events", {
  id:          uuid("id").primaryKey().defaultRandom(),
  source:      text("source").notNull().default("system"), // agent | runner | web | system
  stationId:   uuid("station_id"),
  level:       text("level").notNull().default("info"), // info | warning | error | critical
  eventType:   text("event_type").notNull(),
  message:     text("message").notNull(),
  details:     jsonb("details").notNull().default({}),
  occurredAt:  timestamp("occurred_at", { withTimezone: true }).notNull().defaultNow(),
});

export type SystemEvent = typeof systemEvents.$inferSelect;
export type NewSystemEvent = typeof systemEvents.$inferInsert;
