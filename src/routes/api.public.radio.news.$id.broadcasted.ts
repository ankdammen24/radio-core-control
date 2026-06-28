/**
 * Radio Core integration API — mark a news item as broadcast by a station.
 *
 * POST /api/public/radio/news/{id}/broadcasted
 * Auth: `Authorization: Bearer <station-api-key>`.
 * Body: { stationId: string, broadcastTime?: ISO string, programName?: string }
 *
 * The presenting station key must match the supplied stationId — cross-tenant
 * writes are rejected. The item's status flips to 'broadcasted' on first call.
 */
import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";

const Body = z.object({
  stationId: z.string().uuid(),
  broadcastTime: z.string().datetime().optional(),
  programName: z.string().max(200).optional(),
});

export const Route = createFileRoute("/api/public/radio/news/$id/broadcasted")({
  server: {
    handlers: {
      POST: async ({ request, params }) => {
        const { authenticateStationByKey } = await import("@/server/station-api-auth.server");
        const auth = await authenticateStationByKey(request);
        if (!auth.ok) return Response.json({ error: auth.message }, { status: auth.status });

        const raw = await request.json().catch(() => null);
        const parsed = Body.safeParse(raw);
        if (!parsed.success) {
          return Response.json({ error: "Invalid body", details: parsed.error.flatten() }, { status: 400 });
        }
        if (parsed.data.stationId !== auth.station.id) {
          return Response.json({ error: "stationId does not match API key" }, { status: 403 });
        }

        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const { data: item, error: itemErr } = await supabaseAdmin
          .from("news_items").select("id,status").eq("id", params.id).maybeSingle();
        if (itemErr) return Response.json({ error: itemErr.message }, { status: 500 });
        if (!item) return Response.json({ error: "Not found" }, { status: 404 });

        const broadcastTime = parsed.data.broadcastTime ?? new Date().toISOString();
        const { data: history, error: insErr } = await supabaseAdmin
          .from("news_broadcast_history")
          .insert({
            news_item_id: params.id,
            station_id: auth.station.id,
            broadcast_time: broadcastTime,
            program_name: parsed.data.programName ?? null,
          })
          .select()
          .single();
        if (insErr) return Response.json({ error: insErr.message }, { status: 500 });

        if (item.status === "ready_for_radio") {
          await supabaseAdmin.from("news_items").update({ status: "broadcasted" }).eq("id", params.id);
        }

        return Response.json({ ok: true, broadcast: history }, { status: 201 });
      },
    },
  },
});
