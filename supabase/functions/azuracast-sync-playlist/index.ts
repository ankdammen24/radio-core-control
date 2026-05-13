import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders } from "../_shared/cors.ts";
import { requireEditorOrAdmin } from "../_shared/auth.ts";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  const _auth = await requireEditorOrAdmin(req);
  if (!_auth.ok) return _auth.response;
  try {
    const { playlist_id } = await req.json();
    const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    const { data: pl } = await supabase.from("playlists").select("*, playlist_assignments(*, media_files(azuracast_media_id))").eq("id", playlist_id).single();
    const { data: job } = await supabase.from("sync_jobs").insert({ station_id: pl?.station_id, job_type: "playlist_sync", status: "running", started_at: new Date().toISOString(), payload: { playlist_id } }).select().single();
    // Placeholder: real implementation would PUT to /api/station/{id}/playlist/{pid}/queue
    await supabase.from("sync_jobs").update({ status: "completed", finished_at: new Date().toISOString(), message: `Queued ${pl?.playlist_assignments?.length ?? 0} tracks (placeholder).` }).eq("id", job!.id);
    return new Response(JSON.stringify({ ok: true, job_id: job!.id }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (e: any) {
    return new Response(JSON.stringify({ ok: false, message: e.message }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
