import { createFileRoute } from "@tanstack/react-router";
import { createHash } from "crypto";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

async function authorizeStackToken(request: Request): Promise<boolean> {
  const token = request.headers.get("x-stack-token") ?? "";
  if (!token) return false;
  const hash = createHash("sha256").update(token).digest("hex");
  const { data: tok } = await supabaseAdmin
    .from("stack_tokens")
    .select("id,is_active")
    .eq("token_hash", hash)
    .maybeSingle();
  return Boolean(tok && tok.is_active);
}

async function authorizeSupabaseUser(request: Request): Promise<boolean> {
  const authHeader = request.headers.get("authorization") ?? "";
  const bearer = authHeader.replace(/^Bearer\s+/i, "").trim();
  if (!bearer) return false;
  const { data, error } = await supabaseAdmin.auth.getUser(bearer);
  if (error || !data.user) return false;
  const { data: roles } = await supabaseAdmin
    .from("user_roles")
    .select("role")
    .eq("user_id", data.user.id);
  return (roles ?? []).some((r) => r.role === "admin" || r.role === "editor");
}

async function authorize(request: Request): Promise<boolean> {
  // Prefer Supabase auth when an Authorization header is present, otherwise
  // fall back to the x-stack-token used by non-authenticated infrastructure clients.
  if (request.headers.get("authorization")) {
    if (await authorizeSupabaseUser(request)) return true;
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
        const { data } = await supabaseAdmin
          .from("service_health")
          .select("service,status,reported_at")
          .order("reported_at", { ascending: false })
          .limit(500);
        const rows = data ?? [];
        // Aggregate: latest status per service + counts
        const latestByService = new Map<string, { status: string; reported_at: string }>();
        const statusCounts: Record<string, number> = {};
        for (const r of rows) {
          if (!latestByService.has(r.service)) {
            latestByService.set(r.service, { status: r.status, reported_at: r.reported_at });
          }
          statusCounts[r.status] = (statusCounts[r.status] ?? 0) + 1;
        }
        const services = Array.from(latestByService.entries()).map(([service, v]) => ({
          service,
          status: v.status,
          last_reported_at: v.reported_at,
        }));
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
          services,
        });
      },
      POST: async ({ request }) => {
        const token = request.headers.get("x-stack-token") ?? "";
        if (!token) return new Response("Unauthorized", { status: 401 });
        const hash = createHash("sha256").update(token).digest("hex");
        const { data: tok } = await supabaseAdmin
          .from("stack_tokens")
          .select("id,station_id,is_active")
          .eq("token_hash", hash)
          .maybeSingle();
        if (!tok || !tok.is_active) return new Response("Unauthorized", { status: 401 });
        const body = await request.json().catch(() => ({} as any));
        const allowedStatus = ["healthy", "degraded", "down", "unknown"];
        const service = String(body?.service ?? "unknown").slice(0, 100);
        const status = allowedStatus.includes(body?.status) ? body.status : "unknown";
        const message = body?.message != null ? String(body.message).slice(0, 1000) : null;
        const details =
          body?.details && typeof body.details === "object" && !Array.isArray(body.details)
            ? body.details
            : null;
        await supabaseAdmin.from("service_health").insert({
          station_id: tok.station_id,
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
