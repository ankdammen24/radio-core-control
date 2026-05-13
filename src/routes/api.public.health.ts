import { createFileRoute } from "@tanstack/react-router";
import { createHash } from "crypto";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

async function authorize(request: Request): Promise<boolean> {
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

export const Route = createFileRoute("/api/public/health")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        if (!(await authorize(request))) {
          return new Response("Unauthorized", { status: 401 });
        }
        const { data } = await supabaseAdmin
          .from("service_health")
          .select("*")
          .order("reported_at", { ascending: false })
          .limit(50);
        return Response.json({ ok: true, recent: data ?? [] });
      },
      POST: async ({ request }) => {
        const token = request.headers.get("x-stack-token") ?? "";
        const hash = createHash("sha256").update(token).digest("hex");
        const { data: tok } = await supabaseAdmin
          .from("stack_tokens")
          .select("id,station_id,is_active")
          .eq("token_hash", hash)
          .maybeSingle();
        if (!tok || !tok.is_active) return new Response("Unauthorized", { status: 401 });
        const body = await request.json().catch(() => ({} as any));
        await supabaseAdmin.from("service_health").insert({
          station_id: tok.station_id,
          service: body.service ?? "unknown",
          status: body.status ?? "unknown",
          message: body.message ?? null,
          details: body.details ?? null,
        });
        return Response.json({ ok: true });
      },
    },
  },
});
