import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders } from "../_shared/cors.ts";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  try {
    const { connection_id, station_id } = await req.json();
    const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    let conn: any = null;
    if (connection_id) {
      conn = (await supabase.from("azuracast_connections").select("*").eq("id", connection_id).maybeSingle()).data;
    } else if (station_id) {
      conn = (await supabase.from("azuracast_connections").select("*").eq("station_id", station_id).limit(1).maybeSingle()).data;
    }
    const apiKey = Deno.env.get(conn?.api_key_secret_name ?? "AZURACAST_API_KEY") ?? Deno.env.get("AZURACAST_API_KEY");
    if (!apiKey || !conn?.base_url || !conn?.azuracast_station_id) {
      return new Response(JSON.stringify({ ok: false, message: "Not configured", now_playing: null }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
    const res = await fetch(`${conn.base_url.replace(/\/$/, "")}/api/nowplaying/${conn.azuracast_station_id}`, { headers: { "X-API-Key": apiKey } });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const np = await res.json();

    // Mirror to local now_playing
    if (conn.station_id && np?.now_playing?.song) {
      const song = np.now_playing.song;
      await supabase.from("now_playing").upsert({
        station_id: conn.station_id,
        title: song.title ?? null,
        artist: song.artist ?? null,
        album: song.album ?? null,
        duration_seconds: np.now_playing.duration ?? null,
        listeners: np.listeners?.current ?? 0,
        started_at: new Date((np.now_playing.played_at ?? Date.now() / 1000) * 1000).toISOString(),
        updated_at: new Date().toISOString(),
      }, { onConflict: "station_id" });
    }

    return new Response(JSON.stringify({ ok: true, now_playing: np }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (e: any) {
    return new Response(JSON.stringify({ ok: false, message: e.message }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
