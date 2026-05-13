import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders } from "../_shared/cors.ts";
import { requireEditorOrAdmin } from "../_shared/auth.ts";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  const _auth = await requireEditorOrAdmin(req);
  if (!_auth.ok) return _auth.response;
  try {
    const body = await req.json();
    const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    const { data, error } = await supabase.from("sync_jobs").insert({
      station_id: body.station_id ?? null,
      job_type: body.job_type ?? "manual",
      status: body.status ?? "pending",
      payload: body.payload ?? null,
      message: body.message ?? null,
    }).select().single();
    if (error) throw error;
    return new Response(JSON.stringify({ ok: true, job: data }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (e: any) {
    return new Response(JSON.stringify({ ok: false, message: e.message }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
