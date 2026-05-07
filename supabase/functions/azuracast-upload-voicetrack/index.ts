import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders } from "../_shared/cors.ts";

// Body: { voicetrack_id: string, filename: string, mime: string, base64: string, playlist_id?: string|number }
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  try {
    const { voicetrack_id, filename, mime, base64, playlist_id } = await req.json();
    if (!voicetrack_id || !base64 || !filename) throw new Error("voicetrack_id, filename, base64 required");

    const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    const { data: vt, error: vtErr } = await supabase.from("voicetracks").select("*").eq("id", voicetrack_id).single();
    if (vtErr || !vt) throw new Error("Voicetrack not found");

    const { data: conn } = await supabase.from("azuracast_connections").select("*").eq("station_id", vt.station_id).eq("status", "ok").maybeSingle();
    const fallback = conn ?? (await supabase.from("azuracast_connections").select("*").eq("station_id", vt.station_id).limit(1).maybeSingle()).data;
    if (!fallback?.base_url || !fallback?.azuracast_station_id) throw new Error("No AzuraCast connection for this station");

    const apiKey = Deno.env.get(fallback.api_key_secret_name ?? "AZURACAST_API_KEY") ?? Deno.env.get("AZURACAST_API_KEY");
    if (!apiKey) throw new Error("AZURACAST_API_KEY not configured");

    await supabase.from("voicetracks").update({ status: "uploading" }).eq("id", voicetrack_id);

    const path = `voicetracks/${filename}`;
    const url = `${fallback.base_url.replace(/\/$/, "")}/api/station/${fallback.azuracast_station_id}/files`;
    const res = await fetch(url, {
      method: "POST",
      headers: { "X-API-Key": apiKey, "Content-Type": "application/json" },
      body: JSON.stringify({ path, file: base64 }),
    });
    const text = await res.text();
    if (!res.ok) {
      await supabase.from("voicetracks").update({ status: "error", error_message: `Upload HTTP ${res.status}: ${text.slice(0, 300)}` }).eq("id", voicetrack_id);
      throw new Error(`AzuraCast upload failed: ${res.status} ${text.slice(0, 300)}`);
    }
    let media: any = {};
    try { media = JSON.parse(text); } catch { /* ignore */ }

    // Optionally attach to a playlist
    if (playlist_id && media?.id) {
      try {
        await fetch(`${fallback.base_url.replace(/\/$/, "")}/api/station/${fallback.azuracast_station_id}/file/${media.id}`, {
          method: "PUT",
          headers: { "X-API-Key": apiKey, "Content-Type": "application/json" },
          body: JSON.stringify({ playlists: [{ id: playlist_id }] }),
        });
      } catch { /* non-fatal */ }
    }

    await supabase.from("voicetracks").update({
      status: "ready",
      azuracast_media_id: media?.id ? String(media.id) : null,
      azuracast_path: path,
      error_message: null,
    }).eq("id", voicetrack_id);

    return new Response(JSON.stringify({ ok: true, media }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (e: any) {
    return new Response(JSON.stringify({ ok: false, message: e.message }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
