import { createFileRoute } from "@tanstack/react-router";
import { createHash } from "crypto";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

async function auth(request: Request) {
  const token = request.headers.get("x-stack-token") ?? "";
  if (!token) return null;
  const hash = createHash("sha256").update(token).digest("hex");
  const { data } = await supabaseAdmin.from("stack_tokens").select("id,station_id,is_active").eq("token_hash", hash).maybeSingle();
  if (!data || !data.is_active) return null;
  return data;
}

export const Route = createFileRoute("/api/public/listener-stats")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const a = await auth(request);
        if (!a) return new Response("Unauthorized", { status: 401 });
        const body = await request.json().catch(() => ({} as any));
        const slug: string | undefined = body.station_slug;
        const { data: station } = slug
          ? await supabaseAdmin.from("stations").select("id").eq("slug", slug).maybeSingle()
          : { data: null as any };
        const targetStationId = station?.id ?? a.station_id;
        // Cross-tenant guard: scoped tokens may only write to their own station.
        if (a.station_id && targetStationId && a.station_id !== targetStationId) {
          return new Response("Forbidden", { status: 403 });
        }
        await supabaseAdmin.from("listener_stats").insert({
          station_id: targetStationId,
          mount_path: body.mount ?? null,
          listeners: body.listeners ?? 0,
          peak_listeners: body.peak ?? body.listeners ?? 0,
        });
        return Response.json({ ok: true });
      },
      GET: async ({ request }) => {
        const a = await auth(request);
        if (!a) return new Response("Unauthorized", { status: 401 });
        const url = new URL(request.url);
        const slug = url.searchParams.get("station");
        let q = supabaseAdmin.from("listener_stats").select("*, stations!inner(slug,name)").order("recorded_at", { ascending: false }).limit(200);
        if (slug) q = q.eq("stations.slug", slug);
        // Scope to the token's station unless it's a global token.
        if (a.station_id) q = q.eq("station_id", a.station_id);
        const { data } = await q;
        return Response.json({ data });
      },
    },
  },
});
