/**
 * POST /api/public/agent/heartbeat
 *
 * Called by the runner daemon on each polling cycle (default: every 30 s).
 * Authenticates via x-stack-token (purpose: runner | agent).
 *
 * Responsibilities:
 *  1. Verify stack token (active, correct purpose)
 *  2. Resolve station from station_slug + cross-tenant guard
 *  3. Upsert agent_instances row (create on first heartbeat, update thereafter)
 *  4. Touch stack_tokens.last_used_at
 *  5. Return reload_requested flag + config_version hint
 *
 * See: docs/architecture/radio-core-v2.md §8 — Runner API contract
 */
import { createFileRoute } from "@tanstack/react-router";
import { createHash } from "crypto";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

// ─── Auth ─────────────────────────────────────────────────────────────────────

type TokenRow = {
  id: string;
  station_id: string | null;
  is_active: boolean;
  purpose: string;
};

async function resolveToken(request: Request): Promise<TokenRow | null> {
  const raw = request.headers.get("x-stack-token") ?? "";
  if (!raw) return null;
  const hash = createHash("sha256").update(raw, "utf8").digest("hex");
  const { data } = await supabaseAdmin
    .from("stack_tokens")
    .select("id,station_id,is_active,purpose")
    .eq("token_hash", hash)
    .maybeSingle();
  return data ?? null;
}

// ─── Body schema (manual validation — no Zod in route handlers) ───────────────

type HeartbeatBody = {
  agent_id?: unknown;
  station_slug?: unknown;
  hostname?: unknown;
  version?: unknown;
  capabilities?: unknown;
  metrics?: unknown;
};

function safeString(v: unknown, max = 255): string | null {
  if (typeof v !== "string" || !v.trim()) return null;
  return v.trim().slice(0, max);
}

function safeObject(v: unknown): Record<string, unknown> {
  if (v && typeof v === "object" && !Array.isArray(v)) return v as Record<string, unknown>;
  return {};
}

function isUuid(v: unknown): v is string {
  return typeof v === "string" && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(v);
}

// ─── config_version helper ────────────────────────────────────────────────────
// A lightweight hash representing the "current" config epoch for a station.
// In Fas 5+ this will reflect the actual rendered config hash so runners can
// detect changes without a full reload. For now it's based on station updated_at.

async function computeConfigVersion(stationId: string): Promise<string> {
  const { data } = await supabaseAdmin
    .from("stations")
    .select("updated_at")
    .eq("id", stationId)
    .maybeSingle();
  const seed = data?.updated_at ?? stationId;
  return createHash("sha256").update(seed).digest("hex").slice(0, 16);
}

// ─── Route ────────────────────────────────────────────────────────────────────

export const Route = createFileRoute("/api/public/agent/heartbeat")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        // 1. Authenticate
        const tok = await resolveToken(request);

        if (!tok) {
          return new Response(
            JSON.stringify({ ok: false, error: "Missing or invalid token" }),
            { status: 401, headers: { "Content-Type": "application/json" } },
          );
        }
        if (!tok.is_active) {
          return new Response(
            JSON.stringify({ ok: false, error: "Token revoked" }),
            { status: 401, headers: { "Content-Type": "application/json" } },
          );
        }
        if (tok.purpose !== "runner" && tok.purpose !== "agent") {
          return new Response(
            JSON.stringify({ ok: false, error: `Token purpose '${tok.purpose}' not allowed for heartbeat (need runner or agent)` }),
            { status: 403, headers: { "Content-Type": "application/json" } },
          );
        }

        // 2. Parse body
        let body: HeartbeatBody;
        try {
          body = await request.json();
        } catch {
          return Response.json({ ok: false, error: "Invalid JSON body" }, { status: 400 });
        }

        const agentId   = isUuid(body.agent_id) ? body.agent_id : null;
        const stationSlug = safeString(body.station_slug, 120);
        const hostname  = safeString(body.hostname);
        const version   = safeString(body.version, 50);
        const capabilities = safeObject(body.capabilities);
        const metrics      = safeObject(body.metrics);

        if (!agentId) {
          return Response.json({ ok: false, error: "agent_id must be a valid UUID" }, { status: 400 });
        }
        if (!stationSlug) {
          return Response.json({ ok: false, error: "station_slug is required" }, { status: 400 });
        }

        // 3. Resolve station
        const { data: station } = await supabaseAdmin
          .from("stations")
          .select("id,slug")
          .eq("slug", stationSlug)
          .maybeSingle();

        if (!station) {
          return Response.json({ ok: false, error: `Station '${stationSlug}' not found` }, { status: 404 });
        }

        // 4. Cross-tenant guard: station-scoped token may only heartbeat for its own station
        if (tok.station_id && tok.station_id !== station.id) {
          return Response.json({ ok: false, error: "Token station mismatch" }, { status: 403 });
        }

        const now = new Date().toISOString();

        // 5. Upsert agent_instances
        // Look up existing agent to detect first-ever heartbeat
        const { data: existing } = await supabaseAdmin
          .from("agent_instances")
          .select("id,last_seen_at,reload_requested_at")
          .eq("id", agentId)
          .maybeSingle();

        const isFirstHeartbeat = !existing;
        const reloadRequestedAt = existing?.reload_requested_at ?? null;
        const reloadRequested = Boolean(reloadRequestedAt);

        const agentPayload = {
          id: agentId,
          station_id: station.id,
          // Use hostname as name if no prior name exists; existing name is preserved via upsert
          name: hostname ?? `agent-${agentId.slice(0, 8)}`,
          hostname,
          version,
          status: "online" as const,
          last_seen_at: now,
          capabilities: capabilities as never,
          metrics: metrics as never,
          // Clear reload_requested_at only if it was set (acknowledge the request)
          ...(reloadRequested ? { reload_requested_at: null } : {}),
        };

        const { error: upsertError } = await supabaseAdmin
          .from("agent_instances")
          .upsert(agentPayload, { onConflict: "id" });

        if (upsertError) {
          console.error("[heartbeat] upsert error:", upsertError);
          return Response.json({ ok: false, error: "Database error" }, { status: 500 });
        }

        // 6. Touch stack_tokens.last_used_at
        await supabaseAdmin
          .from("stack_tokens")
          .update({ last_used_at: now })
          .eq("id", tok.id);

        // 7. Audit log on first heartbeat (best-effort)
        if (isFirstHeartbeat) {
          supabaseAdmin.from("audit_logs").insert({
            user_id: null,
            action: "agent.first_heartbeat",
            entity_type: "agent_instances",
            entity_id: agentId,
            new_value: {
              hostname,
              version,
              station_slug: stationSlug,
              station_id: station.id,
            } as never,
          }).then(() => {}).catch(() => {});
        }

        // 8. Config version
        const configVersion = await computeConfigVersion(station.id);

        return Response.json({
          ok: true,
          server_time: now,
          station_slug: station.slug,
          reload_requested: reloadRequested,
          config_version: configVersion,
        });
      },
    },
  },
});
