/**
 * Stack Token server functions.
 *
 * Stack tokens are long-lived secrets used by the runner and other API consumers
 * to authenticate against Radio Core's public API (/api/public/*).
 *
 * Security model:
 *  - Raw secret is generated server-side with crypto.randomBytes(32)
 *  - Only the SHA-256 hex hash is stored in the database
 *  - The raw secret is returned ONCE in the createStackToken response
 *  - The raw secret is NEVER stored, logged, or returned again
 *  - token_hash is NEVER included in listStackTokens responses
 *
 * See: docs/architecture/radio-core-v2.md §2.2 and §13 (environment variables)
 */
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { createHash, randomBytes } from "crypto";
import { requireSupabaseAuth } from "@/services/database/auth-middleware";
import { adminDatabase } from "@/services/database/server";

// ─── Purpose values ──────────────────────────────────────────────────────────

export const TOKEN_PURPOSES = ["runner", "agent", "api"] as const;
export type TokenPurpose = typeof TOKEN_PURPOSES[number];

// ─── Types ────────────────────────────────────────────────────────────────────

export type StackTokenRow = {
  id: string;
  name: string;
  purpose: string;
  station_id: string | null;
  is_active: boolean;
  last_used_at: string | null;
  revoked_at: string | null;
  created_at: string;
};

// ─── Helpers ─────────────────────────────────────────────────────────────────

function hashToken(raw: string): string {
  return createHash("sha256").update(raw, "utf8").digest("hex");
}

function generateTokenSecret(): { raw: string; hash: string } {
  const buf = randomBytes(32);
  const raw = "rck_" + buf.toString("base64url");
  return { raw, hash: hashToken(raw) };
}

async function requireAdmin(context: { supabase: ReturnType<typeof Object>; userId: string | null }) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: roles } = await (context.supabase as any)
    .from("user_roles")
    .select("role")
    .eq("user_id", context.userId);
  const isAdmin = (roles ?? []).some((r: { role: string }) => r.role === "admin");
  if (!isAdmin) throw new Response("Forbidden", { status: 403 });
}

// ─── listStackTokens ──────────────────────────────────────────────────────────

export const listStackTokens = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) =>
    z.object({
      station_id: z.string().uuid().nullable().optional(),
    }).parse(i ?? {}),
  )
  .handler(async ({ data, context }) => {
    await requireAdmin(context);

    // IMPORTANT: never select token_hash — it must stay server-side only.
    let q = adminDatabase
      .from("stack_tokens")
      .select("id,name,purpose,station_id,is_active,last_used_at,revoked_at,created_at")
      .order("created_at", { ascending: false });

    if (data.station_id) q = q.eq("station_id", data.station_id);

    const { data: rows, error } = await q;
    if (error) throw error;
    return { tokens: (rows ?? []) as StackTokenRow[] };
  });

// ─── createStackToken ─────────────────────────────────────────────────────────

const createSchema = z.object({
  name: z.string().min(1).max(120),
  purpose: z.enum(TOKEN_PURPOSES),
  station_id: z.string().uuid().nullable().optional(),
});

export const createStackToken = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => createSchema.parse(i))
  .handler(async ({ data, context }) => {
    await requireAdmin(context);

    const { raw, hash } = generateTokenSecret();

    const { data: row, error } = await adminDatabase
      .from("stack_tokens")
      .insert({
        name: data.name,
        purpose: data.purpose,
        station_id: data.station_id ?? null,
        token_hash: hash,
        is_active: true,
      })
      .select("id,name,purpose,station_id,is_active,created_at")
      .single();

    if (error) throw error;

    // Audit log — best-effort, do not fail the creation if audit fails
    try {
      await adminDatabase.from("audit_logs").insert({
        user_id: context.userId,
        action: "stack_token.created",
        entity_type: "stack_tokens",
        entity_id: row.id,
        new_value: {
          name: data.name,
          purpose: data.purpose,
          station_id: data.station_id ?? null,
        } as never,
      });
    } catch (_) { /* non-fatal */ }

    return {
      ok: true as const,
      token: row as Omit<StackTokenRow, "last_used_at" | "revoked_at">,
      // raw_secret is returned ONCE. It is never stored or returned again.
      raw_secret: raw,
    };
  });

// ─── revokeStackToken ─────────────────────────────────────────────────────────

export const revokeStackToken = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => z.object({ id: z.string().uuid() }).parse(i))
  .handler(async ({ data, context }) => {
    await requireAdmin(context);

    const now = new Date().toISOString();
    const { data: row, error } = await adminDatabase
      .from("stack_tokens")
      .update({ is_active: false, revoked_at: now })
      .eq("id", data.id)
      .select("id,name,purpose")
      .single();

    if (error) throw error;

    // Also deactivate any agent_instances using this token
    await adminDatabase
      .from("agent_instances")
      .update({ status: "offline" })
      .eq("stack_token_id", data.id);

    // Audit log
    try {
      await adminDatabase.from("audit_logs").insert({
        user_id: context.userId,
        action: "stack_token.revoked",
        entity_type: "stack_tokens",
        entity_id: data.id,
        new_value: { name: row.name, purpose: row.purpose } as never,
      });
    } catch (_) { /* non-fatal */ }

    return { ok: true as const, token: row };
  });
