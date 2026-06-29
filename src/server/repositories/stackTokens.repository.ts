/**
 * Stack Tokens repository — Drizzle ORM
 *
 * Hanterar autentisering av runner/agent/api-tokens via SHA-256-hash.
 * Alla skrivningar använder parametriserade queries via Drizzle.
 */
import { createHash } from "crypto";
import { eq } from "drizzle-orm";
import { db } from "@/server/db/client";
import { stackTokens } from "@/server/db/schema";

export type TokenRow = typeof stackTokens.$inferSelect;

// ─── Helpers ──────────────────────────────────────────────────────────────────

export function hashToken(raw: string): string {
  return createHash("sha256").update(raw, "utf8").digest("hex");
}

// ─── Queries ──────────────────────────────────────────────────────────────────

/** Löser upp en rå token-sträng och returnerar token-raden om aktiv. */
export async function resolveStackToken(raw: string): Promise<TokenRow | null> {
  const hash = hashToken(raw);
  const rows = await db
    .select()
    .from(stackTokens)
    .where(eq(stackTokens.tokenHash, hash))
    .limit(1);
  const row = rows[0] ?? null;
  if (!row || !row.isActive) return null;
  return row;
}

/** Uppdaterar last_used_at för en token efter lyckad autentisering. */
export async function touchStackToken(id: string): Promise<void> {
  await db
    .update(stackTokens)
    .set({ lastUsedAt: new Date() })
    .where(eq(stackTokens.id, id));
}
