/**
 * Drizzle schema — users, user_roles, sessions
 *
 * Lokal auth ersätter Supabase Auth.
 * sessions-tabellen lagrar JWT-tokens (hashed) + löptidinformation.
 */
import { pgTable, text, boolean, timestamp, uuid } from "drizzle-orm/pg-core";

// ─── users ────────────────────────────────────────────────────────────────────
export const users = pgTable("users", {
  id:           uuid("id").primaryKey().defaultRandom(),
  email:        text("email").notNull().unique(),
  passwordHash: text("password_hash"),
  displayName:  text("display_name"),
  avatarUrl:    text("avatar_url"),
  isActive:     boolean("is_active").notNull().default(true),
  lastSignInAt: timestamp("last_sign_in_at", { withTimezone: true }),
  createdAt:    timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt:    timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export type User = typeof users.$inferSelect;
export type NewUser = typeof users.$inferInsert;

// ─── user_roles ───────────────────────────────────────────────────────────────
export const userRoles = pgTable("user_roles", {
  id:        uuid("id").primaryKey().defaultRandom(),
  userId:    uuid("user_id").notNull(),
  role:      text("role").notNull().default("viewer"), // admin | editor | viewer
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export type UserRole = typeof userRoles.$inferSelect;
export type NewUserRole = typeof userRoles.$inferInsert;

// ─── sessions ─────────────────────────────────────────────────────────────────
// Server-side session store (JWT refresh tokens / session tokens)
export const sessions = pgTable("sessions", {
  id:           uuid("id").primaryKey().defaultRandom(),
  userId:       uuid("user_id").notNull(),
  tokenHash:    text("token_hash").notNull().unique(), // SHA-256 av access token
  userAgent:    text("user_agent"),
  ipAddress:    text("ip_address"),
  expiresAt:    timestamp("expires_at", { withTimezone: true }).notNull(),
  revokedAt:    timestamp("revoked_at", { withTimezone: true }),
  createdAt:    timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  lastUsedAt:   timestamp("last_used_at", { withTimezone: true }).notNull().defaultNow(),
});

export type Session = typeof sessions.$inferSelect;
export type NewSession = typeof sessions.$inferInsert;
