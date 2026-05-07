import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders } from "../_shared/cors.ts";

// Body: { station_id: string }  -> pulls AzuraCast file list into media_files
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  try {
    const { station_id } = await req.json();
    if (!station_id) throw new Error("station_id required");
    const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

    const { data: conn } = await supabase.from("azuracast_connections").select("*").eq("station_id", station_id).limit(1).maybeSingle();
    if (!conn?.base_url || !conn?.azuracast_station_id) throw new Error("No AzuraCast connection for station");
    const apiKey = Deno.env.get(conn.api_key_secret_name ?? "AZURACAST_API_KEY") ?? Deno.env.get("AZURACAST_API_KEY");
    if (!apiKey) throw new Error("AZURACAST_API_KEY not configured");

    const { data: job } = await supabase.from("sync_jobs").insert({ station_id, job_type: "media_pull", status: "running", started_at: new Date().toISOString() }).select().single();

    const res = await fetch(`${conn.base_url.replace(/\/$/, "")}/api/station/${conn.azuracast_station_id}/files`, { headers: { "X-API-Key": apiKey } });
    if (!res.ok) {
      const t = await res.text();
      await supabase.from("sync_jobs").update({ status: "failed", finished_at: new Date().toISOString(), message: `HTTP ${res.status}: ${t.slice(0,300)}` }).eq("id", job!.id);
      throw new Error(`HTTP ${res.status}`);
    }
    const items = await res.json() as any[];

    let upserted = 0;
    for (const it of items) {
      const row = {
        station_id,
        azuracast_media_id: String(it.id),
        file_name: it.path?.split("/").pop() ?? it.title ?? `file-${it.id}`,
        original_file_name: it.title ?? null,
        file_path: it.path ?? null,
        file_type: "audio",
        mime_type: it.mtime_str ? null : null,
        file_size: it.size ?? null,
        duration_seconds: it.length ?? null,
        media_kind: (it.path ?? "").startsWith("voicetracks/") ? "voicetrack" : "music",
        status: "imported",
      };
      const { data: existing } = await supabase.from("media_files").select("id").eq("station_id", station_id).eq("azuracast_media_id", row.azuracast_media_id).maybeSingle();
      if (existing?.id) {
        await supabase.from("media_files").update(row).eq("id", existing.id);
      } else {
        await supabase.from("media_files").insert(row);
      }
      upserted++;
    }

    await supabase.from("sync_jobs").update({ status: "completed", finished_at: new Date().toISOString(), message: `Synced ${upserted} files from AzuraCast` }).eq("id", job!.id);
    return new Response(JSON.stringify({ ok: true, count: upserted, job_id: job!.id }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (e: any) {
    return new Response(JSON.stringify({ ok: false, message: e.message }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
