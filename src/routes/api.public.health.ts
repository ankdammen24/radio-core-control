/**
 * GET  /api/public/health  — Kräver x-stack-token eller Bearer (admin/editor)
 * POST /api/public/health  — Kräver x-stack-token
 *
 * Migrerad från Supabase till Drizzle ORM.
 */
import { createFileRoute } from "@tanstack/react-router";
import { resolveStackToken } from "@/server/repositories/stackTokens.repository";
import { insertServiceHealth, getLatestHealthByService } from "@/server/repositories/health.repository";

async function authorizeStackToken(request: Request): Promise<boolean> {
  const raw = request.headers.get("x-stack-token") ?? "";
  if (!raw) return false;
  const tok = await resolveStackToken(raw);
  return Boolean(tok);
}

// TODO: ersätt med lokal JWT-verifiering + user_roles-kontroll via Drizzle
async function authorizeLocalUser(_request: Request): Promise<boolean> {
  // Stub: i dev-läge accepterar vi alla Authorization-headers som admin
  if (process.env.NODE_ENV !== "production") return true;
  return false;
}

async function authorize(request: Request): Promise<boolean> {
  if (request.headers.get("authorization")) {
    if (await authorizeLocalUser(request)) return true;
  }
  return authorizeStackToken(request);
}

export const Route = createFileRoute("/api/public/health")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        if (!(await authorize(request))) {
          return new Response("Unauthorized", { status: 401 });
        }

        const services = await getLatestHealthByService();
        const statusCounts: Record<string, number> = {};
        for (const s of services) {
          statusCounts[s.status] = (statusCounts[s.status] ?? 0) + 1;
        }
        const overall = services.every((s) => s.status === "healthy")
          ? "healthy"
          : services.some((s) => s.status === "down")
            ? "down"
            : services.some((s) => s.status === "degraded")
              ? "degraded"
              : "unknown";

        return Response.json({
          ok: true,
          overall,
          services_count: services.length,
          status_counts: statusCounts,
          services: services.map((s) => ({
            service: s.service,
            status: s.status,
            last_reported_at: s.lastReportedAt,
          })),
        });
      },

      POST: async ({ request }) => {
        const raw = request.headers.get("x-stack-token") ?? "";
        if (!raw) return new Response("Unauthorized", { status: 401 });
        const tok = await resolveStackToken(raw);
        if (!tok) return new Response("Unauthorized", { status: 401 });

        const body = await request.json().catch(() => ({} as any));
        const allowedStatus = ["healthy", "degraded", "down", "unknown"];
        const service = String(body?.service ?? "unknown").slice(0, 100);
        const status = allowedStatus.includes(body?.status) ? body.status : "unknown";
        const message = body?.message != null ? String(body.message).slice(0, 1000) : null;
        const details =
          body?.details && typeof body.details === "object" && !Array.isArray(body.details)
            ? body.details
            : null;

        await insertServiceHealth({
          stationId: tok.stationId,
          service,
          status,
          message,
          details,
        });

        return Response.json({ ok: true });
      },
    },
  },
});
