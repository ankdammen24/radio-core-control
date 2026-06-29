import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { database } from "@/services/database";
import { ResourcePageShell } from "@/components/resource-page-shell";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { StatusBadge } from "@/components/status-badge";
import { SyncStatusBadge, type SyncStatus } from "@/components/sync-status-badge";
import { useState, useMemo } from "react";
import { useStationScope } from "@/lib/station-context";

export const Route = createFileRoute("/media")({ component: MediaPage });

function deriveSyncStatus(m: { status?: string | null; azuracast_media_id?: string | null }): SyncStatus | null {
  if (!("azuracast_media_id" in m)) return null;
  if (m.status === "synced") return "synced";
  if (m.status === "error") return "failed";
  if (m.azuracast_media_id) return "synced";
  return "local_only";
}

function MediaPage() {
  const [q, setQ] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [rightsFilter, setRightsFilter] = useState<string>("all");
  const { scope } = useStationScope();

  const query = useQuery({
    queryKey: ["media-files"],
    queryFn: async () => {
      const { data, error } = await database
        .from("media_files")
        .select("*, track_metadata(*), stations(name)")
        .order("created_at", { ascending: false })
        .limit(500);
      if (error) throw error;
      return data ?? [];
    },
  });

  const filtered = useMemo(() => {
    return (query.data ?? []).filter((m: any) => {
      const md = m.track_metadata;
      if (statusFilter !== "all" && m.status !== statusFilter) return false;
      if (scope.kind === "station" && m.station_id !== scope.station.id) return false;
      if (rightsFilter !== "all" && md?.rights_status !== rightsFilter) return false;
      if (q) {
        const hay = [m.file_name, md?.artist, md?.title, md?.genre].filter(Boolean).join(" ").toLowerCase();
        if (!hay.includes(q.toLowerCase())) return false;
      }
      return true;
    });
  }, [query.data, q, statusFilter, rightsFilter, scope]);

  const state =
    query.isLoading ? { kind: "loading" as const } :
    query.error ? { kind: "error" as const, message: (query.error as Error).message, retry: () => query.refetch() } :
    filtered.length === 0 ? { kind: "empty" as const, title: "No media files match", hint: "Adjust filters or import media via your runtime." } :
    { kind: "ready" as const };

  return (
    <ResourcePageShell
      title="Media Library"
      description="All audio files across stations."
      searchValue={q}
      onSearchChange={setQ}
      searchPlaceholder="Search artist, title, genre, file…"
      filters={
        <>
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="h-9 w-40"><SelectValue placeholder="Status" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All statuses</SelectItem>
              {["imported","missing_metadata","ready","synced","error","paused"].map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select value={rightsFilter} onValueChange={setRightsFilter}>
            <SelectTrigger className="h-9 w-40"><SelectValue placeholder="Rights" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All rights</SelectItem>
              {["unknown","cleared","ai_generated","local_permission","creative_commons","needs_review","blocked"].map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
            </SelectContent>
          </Select>
        </>
      }
      state={state}
    >
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Title</TableHead>
            <TableHead>Artist</TableHead>
            <TableHead>Genre</TableHead>
            <TableHead>Station</TableHead>
            <TableHead>Status</TableHead>
            <TableHead>Sync</TableHead>
            <TableHead>Rights</TableHead>
            <TableHead>Tags</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {filtered.map((m: any) => {
            const md = m.track_metadata;
            const sync = deriveSyncStatus(m);
            return (
              <TableRow key={m.id}>
                <TableCell className="font-medium">
                  <Link to="/metadata/$id" params={{ id: m.id }} className="hover:underline">{md?.title ?? m.file_name}</Link>
                </TableCell>
                <TableCell>{md?.artist ?? "—"}</TableCell>
                <TableCell className="text-muted-foreground">{md?.genre ?? "—"}</TableCell>
                <TableCell className="text-muted-foreground">{m.stations?.name ?? "—"}</TableCell>
                <TableCell><StatusBadge status={m.status} /></TableCell>
                <TableCell>{sync && <SyncStatusBadge status={sync} compact />}</TableCell>
                <TableCell>{md?.rights_status && <StatusBadge status={md.rights_status} />}</TableCell>
                <TableCell className="text-xs text-muted-foreground">
                  {md?.is_local_music && "Local "}{md?.is_ai_generated && "AI"}
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </ResourcePageShell>
  );
}
