/**
 * POST /api/public/agent/heartbeat
 *
 * Migrerad från Supabase till Drizzle ORM.
 * Autentiserar via x-stack-token (purpose: runner | agent).
 *
 * 1. Verifierar stack token
 * 2. Löser upp station från station_slug + cross-tenant guard
 * 3. Upsertar agent_instances
 * 4. Uppdaterar stack_tokens.last_used_at
 * 5. Returnerar reload_requested + config_version
 */
import { createFileRoute } from "@tanstack/react-router";

// ─── Helpers ──────────────────────────────────────────────────────────────────

function safeString(v: unknown, max = 255): string | null {
  if (typeof v !== "string" || !v.trim()) return null;
  return v.trim().slice(0, max);
}

function safeObject(v: unknown): Record<string, unknown> {
  if (v && typeof v === "object" && !Array.isArray(v)) return v as Record<string, unknown>;
  return {};
}

function isUuid(v: unknown): v is string {
  return (
    typeof v === "string" &&
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(v)
  );
}

async function computeConfigVersion(
  stationUpdatedAt: Date | null,
  stationId: string,
): Promise<string> {
  const seed = stationUpdatedAt?.toISOString() ?? stationId;
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(seed));
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0"))
    .join("")
    .slice(0, 16);
}

// ─── Route ────────────────────────────────────────────────────────────────────

export const Route = createFileRoute("/api/public/agent/heartbeat")({
  server: {
    handlers: {
      POST: async ({ request }: { request: Request }) => {
        const [tokenRepository, stationRepository, agentRepository, databaseModule, schemaModule] =
          await Promise.all([
            import("@/server/repositories/stackTokens.repository"),
            import("@/server/repositories/stations.repository"),
            import("@/server/repositories/agents.repository"),
            import("@/server/db/client"),
            import("@/server/db/schema"),
          ]);
        const { resolveStackToken, touchStackToken } = tokenRepository;
        const { findStationBySlug } = stationRepository;
        const { findAgentById, upsertAgentInstance } = agentRepository;
        const { db } = databaseModule;
        const { auditLogs } = schemaModule;
        // 1. Autentisera
        const raw = request.headers.get("x-stack-token") ?? "";
        if (!raw) {
          return Response.json({ ok: false, error: "Missing token" }, { status: 401 });
        }

        const tok = await resolveStackToken(raw);
        if (!tok) {
          return Response.json({ ok: false, error: "Missing or invalid token" }, { status: 401 });
        }
        if (tok.purpose !== "runner" && tok.purpose !== "agent") {
          return Response.json(
            {
              ok: false,
              error: `Token purpose '${tok.purpose}' not allowed (need runner or agent)`,
            },
            { status: 403 },
          );
        }

        // 2. Parsa body
        let body: Record<string, unknown>;
        try {
          body = await request.json();
        } catch {
          return Response.json({ ok: false, error: "Invalid JSON body" }, { status: 400 });
        }

        const agentId = isUuid(body.agent_id) ? body.agent_id : null;
        const stationSlug = safeString(body.station_slug, 120);
        const hostname = safeString(body.hostname);
        const version = safeString(body.version, 50);
        const capabilities = safeObject(body.capabilities);
        const metrics = safeObject(body.metrics);

        if (!agentId) {
          return Response.json(
            { ok: false, error: "agent_id must be a valid UUID" },
            { status: 400 },
          );
        }
        if (!stationSlug) {
          return Response.json({ ok: false, error: "station_slug is required" }, { status: 400 });
        }

        // 3. Löser upp station
        const station = await findStationBySlug(stationSlug);
        if (!station) {
          return Response.json(
            { ok: false, error: `Station '${stationSlug}' not found` },
            { status: 404 },
          );
        }

        // 4. Cross-tenant guard
        if (tok.stationId && tok.stationId !== station.id) {
          return Response.json({ ok: false, error: "Token station mismatch" }, { status: 403 });
        }

        const now = new Date();

        // 5. Kontrollera befintlig agent
        const existing = await findAgentById(agentId);
        const isFirstHeartbeat = !existing;
        const reloadRequestedAt = existing?.reloadRequestedAt ?? null;
        const reloadRequested = Boolean(reloadRequestedAt);

        // 6. Upsert agent_instances
        await upsertAgentInstance({
          id: agentId,
          stationId: station.id,
          name: hostname ?? `agent-${agentId.slice(0, 8)}`,
          hostname,
          version,
          status: "online",
          lastSeenAt: now,
          capabilities: capabilities as never,
          metrics: metrics as never,
          reloadRequestedAt: reloadRequested ? null : undefined,
        });

        // 7. Touch token last_used_at
        await touchStackToken(tok.id);

        // 8. Audit log vid första heartbeat (best-effort)
        if (isFirstHeartbeat) {
          db.insert(auditLogs)
            .values({
              action: "agent.first_heartbeat",
              entityType: "agent_instances",
              entityId: agentId,
              stationId: station.id,
              newValue: {
                hostname,
                version,
                station_slug: stationSlug,
                station_id: station.id,
              } as never,
            })
            .catch(() => {});
        }

        // 9. Config version
        const configVersion = await computeConfigVersion(station.updatedAt, station.id);

        return Response.json({
          ok: true,
          server_time: now.toISOString(),
          station_slug: station.slug,
          reload_requested: reloadRequested,
          config_version: configVersion,
        });
      },
    },
  },
});
