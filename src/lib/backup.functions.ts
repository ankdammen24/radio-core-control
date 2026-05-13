import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export const SNAPSHOT_VERSION = 1;

const uuidSchema = z.string().uuid();

async function requireRole(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  context: { supabase: any; userId: string | null },
  allowed: ("admin" | "editor")[],
) {
  const { data: roles } = await context.supabase
    .from("user_roles")
    .select("role")
    .eq("user_id", context.userId);
  const ok = (roles ?? []).some((r: { role: string }) =>
    (allowed as string[]).includes(r.role),
  );
  if (!ok) throw new Response("Forbidden", { status: 403 });
}

const CHILD_TABLES = [
  "icecast_configs",
  "liquidsoap_configs",
  "stream_mounts",
  "live_inputs",
  "rotation_rules",
  "playlists",
  "schedule_blocks",
  "fallback_tracks",
] as const;

type SnapshotPayload = {
  version: number;
  exported_at: string;
  station: Record<string, any>;
  tables: Record<string, any[]>;
  // playlist_assignments keyed by playlist name (so we can remap after import)
  playlist_assignments: { playlist_name: string; media_file_id: string; weight: number; is_active: boolean }[];
};

export const exportStationSnapshot = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { stationId: string }) => ({ stationId: uuidSchema.parse(d.stationId) }))
  .handler(async ({ data, context }) => {
    await requireRole(context, ["admin", "editor"]);
    const { supabase } = context;
    const { data: station, error: sErr } = await supabase
      .from("stations").select("*").eq("id", data.stationId).maybeSingle();
    if (sErr) throw new Error(sErr.message);
    if (!station) throw new Error("Station not found");

    const tables: Record<string, any[]> = {};
    for (const t of CHILD_TABLES) {
      const { data: rows, error } = await supabase
        .from(t as any).select("*").eq("station_id", data.stationId);
      if (error) throw new Error(`${t}: ${error.message}`);
      tables[t] = rows ?? [];
    }

    // playlist_assignments need to reference playlists; export as (playlist_name, media_file_id, ...)
    const playlistIds = (tables.playlists ?? []).map((p: any) => p.id);
    const playlistAssignments: SnapshotPayload["playlist_assignments"] = [];
    if (playlistIds.length > 0) {
      const { data: pa, error: paErr } = await supabase
        .from("playlist_assignments")
        .select("playlist_id,media_file_id,weight,is_active")
        .in("playlist_id", playlistIds);
      if (paErr) throw new Error(paErr.message);
      const nameById = new Map<string, string>(
        (tables.playlists ?? []).map((p: any) => [p.id, p.name])
      );
      for (const r of pa ?? []) {
        playlistAssignments.push({
          playlist_name: nameById.get(r.playlist_id) ?? "",
          media_file_id: r.media_file_id,
          weight: r.weight,
          is_active: r.is_active,
        });
      }
    }

    const payload: SnapshotPayload = {
      version: SNAPSHOT_VERSION,
      exported_at: new Date().toISOString(),
      station,
      tables,
      playlist_assignments: playlistAssignments,
    };
    return payload;
  });

// Strip internal/conflicting fields and rewrite station_id
function cleanRow(row: any, newStationId: string) {
  const { id, created_at, updated_at, station_id, ...rest } = row;
  return { ...rest, station_id: newStationId };
}

export const importStationSnapshot = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { targetStationId: string; snapshot: SnapshotPayload; replace: boolean }) => ({
    ...d,
    targetStationId: uuidSchema.parse(d.targetStationId),
  }))
  .handler(async ({ data, context }) => {
    // Destructive replace requires admin; non-replace bulk-insert requires admin too
    // (bypasses normal per-record UI validation, so editor-level is too broad).
    await requireRole(context, ["admin"]);
    const { supabase } = context;
    const { targetStationId, snapshot, replace } = data;

    if (!snapshot || snapshot.version !== SNAPSHOT_VERSION) {
      throw new Error(`Unsupported snapshot version: ${snapshot?.version}`);
    }
    const { data: station, error: sErr } = await supabase
      .from("stations").select("id").eq("id", targetStationId).maybeSingle();
    if (sErr) throw new Error(sErr.message);
    if (!station) throw new Error("Target station not found");

    const summary: Record<string, number> = {};

    if (replace) {
      // Wipe child tables for target station (order matters because of FKs)
      const wipeOrder = [
        "playlist_assignments", // via playlists FK cascade, but we also clear schedule
        "schedule_blocks",
        "fallback_tracks",
        "playlists",
        "rotation_rules",
        "stream_mounts",
        "live_inputs",
        "icecast_configs",
        "liquidsoap_configs",
      ];
      for (const t of wipeOrder) {
        if (t === "playlist_assignments") {
          // delete via playlist_id IN (existing playlists for station)
          const { data: pls } = await supabase.from("playlists").select("id").eq("station_id", targetStationId);
          const ids = (pls ?? []).map((p: any) => p.id);
          if (ids.length > 0) {
            const { error } = await supabase.from("playlist_assignments").delete().in("playlist_id", ids);
            if (error) throw new Error(`wipe ${t}: ${error.message}`);
          }
          continue;
        }
        const { error } = await supabase.from(t as any).delete().eq("station_id", targetStationId);
        if (error) throw new Error(`wipe ${t}: ${error.message}`);
      }
    }

    // Insert in dependency-safe order
    const insertOrder = [
      "icecast_configs",
      "liquidsoap_configs",
      "stream_mounts",
      "live_inputs",
      "rotation_rules",
      "playlists",
      "schedule_blocks",
      "fallback_tracks",
    ];

    // Map old playlist id → new playlist id (for assignments + schedule_blocks.playlist_id)
    const playlistOldToNew = new Map<string, string>();
    // Map old rotation_rule id → new
    const rotationOldToNew = new Map<string, string>();

    // pre-insert rotation rules separately to map ids before schedule_blocks
    for (const t of insertOrder) {
      const rows: any[] = (snapshot.tables[t] ?? []);
      if (rows.length === 0) continue;

      if (t === "schedule_blocks") {
        const remapped = rows.map((r) => {
          const c = cleanRow(r, targetStationId);
          if (c.playlist_id) c.playlist_id = playlistOldToNew.get(c.playlist_id) ?? null;
          if (c.rotation_rule_id) c.rotation_rule_id = rotationOldToNew.get(c.rotation_rule_id) ?? null;
          return c;
        });
        const { error, data: ins } = await supabase.from("schedule_blocks").insert(remapped).select("id");
        if (error) throw new Error(`insert ${t}: ${error.message}`);
        summary[t] = ins?.length ?? 0;
        continue;
      }

      if (t === "playlists") {
        const cleaned = rows.map((r) => cleanRow(r, targetStationId));
        const { data: ins, error } = await supabase.from("playlists").insert(cleaned).select("id,name");
        if (error) throw new Error(`insert ${t}: ${error.message}`);
        // map by name (assumes unique names within station)
        const nameToNew = new Map<string, string>((ins ?? []).map((p: any) => [p.name, p.id]));
        for (const r of rows) {
          const newId = nameToNew.get(r.name);
          if (newId) playlistOldToNew.set(r.id, newId);
        }
        summary[t] = ins?.length ?? 0;
        continue;
      }

      if (t === "rotation_rules") {
        const cleaned = rows.map((r) => cleanRow(r, targetStationId));
        const { data: ins, error } = await supabase.from("rotation_rules").insert(cleaned).select("id,name");
        if (error) throw new Error(`insert ${t}: ${error.message}`);
        const nameToNew = new Map<string, string>((ins ?? []).map((p: any) => [p.name, p.id]));
        for (const r of rows) {
          const newId = nameToNew.get(r.name);
          if (newId) rotationOldToNew.set(r.id, newId);
        }
        summary[t] = ins?.length ?? 0;
        continue;
      }

      // singletons (icecast_configs, liquidsoap_configs, live_inputs)
      // already wiped if replace=true; if not, may collide on unique constraint — try upsert by station_id
      const cleaned = rows.map((r) => cleanRow(r, targetStationId));
      const { data: ins, error } = await supabase.from(t as any).insert(cleaned).select("id");
      if (error) throw new Error(`insert ${t}: ${error.message}`);
      summary[t] = ins?.length ?? 0;
    }

    // playlist_assignments — remap playlist by name, validate media_file exists (skip if missing)
    if (snapshot.playlist_assignments.length > 0) {
      const mediaIds = Array.from(new Set(snapshot.playlist_assignments.map((a) => a.media_file_id)));
      const { data: existingMedia } = await supabase
        .from("media_files").select("id").in("id", mediaIds);
      const validMedia = new Set((existingMedia ?? []).map((m: any) => m.id));

      const nameToNewPlaylist = new Map<string, string>();
      for (const [oldId, newId] of playlistOldToNew) {
        const oldPlaylist = (snapshot.tables.playlists ?? []).find((p: any) => p.id === oldId);
        if (oldPlaylist) nameToNewPlaylist.set(oldPlaylist.name, newId);
      }

      const toInsert = snapshot.playlist_assignments
        .filter((a) => validMedia.has(a.media_file_id) && nameToNewPlaylist.has(a.playlist_name))
        .map((a) => ({
          playlist_id: nameToNewPlaylist.get(a.playlist_name)!,
          media_file_id: a.media_file_id,
          weight: a.weight,
          is_active: a.is_active,
        }));
      const skipped = snapshot.playlist_assignments.length - toInsert.length;
      if (toInsert.length > 0) {
        const { error } = await supabase.from("playlist_assignments").insert(toInsert);
        if (error) throw new Error(`insert playlist_assignments: ${error.message}`);
      }
      summary["playlist_assignments"] = toInsert.length;
      summary["playlist_assignments_skipped_missing_media"] = skipped;
    }

    return { ok: true, summary };
  });
