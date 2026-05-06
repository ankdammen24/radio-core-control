import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders } from "../_shared/cors.ts";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  try {
    const { connection_id } = await req.json();
    const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    const { data: conn } = await supabase.from("azuracast_connections").select("*").eq("id", connection_id).single();
    const apiKey = Deno.env.get(conn?.api_key_secret_name ?? "AZURACAST_API_KEY");
    if (!apiKey || !conn?.base_url || !conn?.azuracast_station_id) {
      return new Response(JSON.stringify({ ok: false, message: "Not configured", now_playing: null }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
    const res = await fetch(`${conn.base_url.replace(/\/$/, "")}/api/nowplaying/${conn.azuracast_station_id}`, { headers: { "X-API-Key": apiKey } });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return new Response(JSON.stringify({ ok: true, now_playing: await res.json() }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (e: any) {
    return new Response(JSON.stringify({ ok: false, message: e.message }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
