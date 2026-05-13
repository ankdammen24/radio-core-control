import { createFileRoute } from "@tanstack/react-router";
import { createHash } from "crypto";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

async function authStation(request: Request): Promise<{ stationId: string | null; tokenId: string } | null> {
  const token = request.headers.get("x-stack-token") ?? "";
  if (!token) return null;
  const hash = createHash("sha256").update(token).digest("hex");
  const { data } = await supabaseAdmin
    .from("stack_tokens").select("id,station_id,is_active").eq("token_hash", hash).maybeSingle();
  if (!data || !data.is_active) return null;
  await supabaseAdmin.from("stack_tokens").update({ last_used_at: new Date().toISOString() }).eq("id", data.id);
  return { stationId: data.station_id, tokenId: data.id };
}

export const Route = createFileRoute("/api/public/now-playing")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const url = new URL(request.url);
        const slug = url.searchParams.get("station");
        let q = supabaseAdmin.from("now_playing").select("*, stations!inner(name,slug)");
        if (slug) q = q.eq("stations.slug", slug);
        const { data, error } = await q;
        if (error) return Response.json({ error: error.message }, { status: 500 });
        return Response.json({ data });
      },
      POST: async ({ request }) => {
        const auth = await authStation(request);
        if (!auth) return new Response("Unauthorized", { status: 401 });
        const body = await request.json().catch(() => ({} as any));
        const slug: string | undefined = body.station_slug;
        if (!slug) return Response.json({ error: "station_slug required" }, { status: 400 });
        const { data: station } = await supabaseAdmin.from("stations").select("id").eq("slug", slug).maybeSingle();
        if (!station) return Response.json({ error: "Unknown station" }, { status: 404 });
        // Cross-tenant guard: scoped tokens may only write to their own station.
        if (auth.stationId && auth.stationId !== station.id) {
          return new Response("Forbidden", { status: 403 });
        }
        const row = {
          station_id: station.id,
          title: body.title ?? null,
          artist: body.artist ?? null,
          album: body.album ?? null,
          mount_path: body.mount ?? null,
          listeners: body.listeners ?? 0,
          started_at: new Date().toISOString(),
        };
        await supabaseAdmin.from("now_playing").upsert(row, { onConflict: "station_id" });
        await supabaseAdmin.from("play_history").insert({
          station_id: station.id,
          title: row.title, artist: row.artist, album: row.album, listeners: row.listeners,
        });
        return Response.json({ ok: true });
      },
    },
  },
});
