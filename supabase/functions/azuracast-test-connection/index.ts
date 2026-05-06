import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders } from "../_shared/cors.ts";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  try {
    const { connection_id } = await req.json();
    const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    const { data: conn } = await supabase.from("azuracast_connections").select("*").eq("id", connection_id).single();
    if (!conn) throw new Error("Connection not found");

    const apiKey = Deno.env.get(conn.api_key_secret_name ?? "AZURACAST_API_KEY");
    if (!apiKey || !conn.base_url) {
      await supabase.from("azuracast_connections").update({ status: "error", last_tested_at: new Date().toISOString() }).eq("id", connection_id);
      return new Response(JSON.stringify({ ok: false, message: "Missing API key or base URL. Add AZURACAST_API_KEY in backend secrets." }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const res = await fetch(`${conn.base_url.replace(/\/$/, "")}/api/stations`, { headers: { "X-API-Key": apiKey } });
    const ok = res.ok;
    await supabase.from("azuracast_connections").update({ status: ok ? "ok" : "error", last_tested_at: new Date().toISOString() }).eq("id", connection_id);
    return new Response(JSON.stringify({ ok, message: ok ? "Connection successful" : `HTTP ${res.status}` }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (e: any) {
    return new Response(JSON.stringify({ ok: false, message: e.message }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
