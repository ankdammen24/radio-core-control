import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { ResourcePageShell } from "@/components/resource-page-shell";
import { Card } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { SyncStatusBadge, type SyncStatus } from "@/components/sync-status-badge";
import { RefreshCw, Activity, CheckCircle2, XCircle, Clock, PlayCircle } from "lucide-react";
import { useAuth } from "@/lib/auth";
import { useStationScope } from "@/lib/station-context";
import { toast } from "sonner";
import { useMemo, useState } from "react";

export const Route = createFileRoute("/sync-jobs")({ component: SyncJobsPage });

const statusIcon = {
  pending: Clock, running: PlayCircle, completed: CheckCircle2, failed: XCircle,
} as const;

const statusColor = {
  pending: "text-muted-foreground",
  running: "text-info",
  completed: "text-success",
  failed: "text-destructive",
} as const;

function mapJobStatus(s: string): SyncStatus {
  switch (s) {
    case "completed": return "synced";
    case "failed":    return "failed";
    case "running":   return "pushing";
    default:          return "pending";
  }
}

function SyncJobsPage() {
  const qc = useQueryClient();
  const { isEditor } = useAuth();
  const { scope } = useStationScope();
  const [filter, setFilter] = useState<string>("all");
  const [q, setQ] = useState("");

  const jobs = useQuery({
    queryKey: ["sync_jobs"],
    queryFn: async () => {
      const { data, error } = await supabase.from("sync_jobs").select("*, stations(name)").order("created_at", { ascending: false }).limit(200);
      if (error) throw error;
      return data ?? [];
    },
    refetchInterval: 10_000,
  });

  const filtered = useMemo(() => (jobs.data ?? []).filter((j: any) => {
    if (scope.kind === "station" && j.station_id !== scope.station.id) return false;
    if (filter !== "all" && j.status !== filter) return false;
    if (q && !`${j.job_type} ${j.message ?? ""} ${j.stations?.name ?? ""}`.toLowerCase().includes(q.toLowerCase())) return false;
    return true;
  }), [jobs.data, filter, q, scope]);

  const retry = useMutation({
    mutationFn: async (j: any) => {
      const { error } = await supabase.from("sync_jobs").insert({ station_id: j.station_id, job_type: j.job_type, status: "pending", payload: j.payload });
      if (error) throw error;
    },
    onSuccess: () => { toast.success("Re-queued"); qc.invalidateQueries({ queryKey: ["sync_jobs"] }); },
    onError: (e: any) => toast.error(e.message),
  });

  const counts = useMemo(() => {
    const c: Record<string, number> = { pending: 0, running: 0, completed: 0, failed: 0 };
    (jobs.data ?? []).forEach((j: any) => { if (c[j.status] !== undefined) c[j.status]++; });
    return c;
  }, [jobs.data]);

  const state =
    jobs.isLoading ? { kind: "loading" as const } :
    jobs.error ? { kind: "error" as const, message: (jobs.error as Error).message, retry: () => jobs.refetch() } :
    filtered.length === 0 ? { kind: "empty" as const, title: "No sync jobs match", hint: "Sync jobs appear when media or playlists are pushed." } :
    { kind: "ready" as const };

  return (
    <ResourcePageShell
      title="Sync Jobs"
      description="Background sync between Radio Core and runtime. Auto-refreshes every 10s."
      primaryAction={
        <Button variant="outline" size="sm" onClick={() => jobs.refetch()}>
          <RefreshCw className="w-4 h-4 mr-1" /> Refresh
        </Button>
      }
      searchValue={q}
      onSearchChange={setQ}
      searchPlaceholder="Search type, station, message…"
      filters={
        <Select value={filter} onValueChange={setFilter}>
          <SelectTrigger className="h-9 w-40"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All statuses</SelectItem>
            <SelectItem value="pending">Pending</SelectItem>
            <SelectItem value="running">Running</SelectItem>
            <SelectItem value="completed">Completed</SelectItem>
            <SelectItem value="failed">Failed</SelectItem>
          </SelectContent>
        </Select>
      }
      syncSummary={
        <>
          <SyncStatusBadge status="pending" compact /> <span className="tabular-nums">{counts.pending}</span>
          <SyncStatusBadge status="pushing" compact /> <span className="tabular-nums">{counts.running}</span>
          <SyncStatusBadge status="synced" compact /> <span className="tabular-nums">{counts.completed}</span>
          <SyncStatusBadge status="failed" compact /> <span className="tabular-nums">{counts.failed}</span>
        </>
      }
      state={{ kind: "ready" }}
      wrapContent={false}
    >
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="lg:col-span-2">
          <Card className="overflow-hidden">
            {state.kind === "loading" && <div className="p-8 text-sm text-muted-foreground">Loading…</div>}
            {state.kind === "error" && <div className="p-8 text-sm text-destructive">{state.message}</div>}
            {state.kind === "empty" && <div className="p-8 text-sm text-muted-foreground text-center">{state.title}</div>}
            {state.kind === "ready" && (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Created</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead>Station</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Message</TableHead>
                    <TableHead className="w-24" />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtered.map((j: any) => (
                    <TableRow key={j.id}>
                      <TableCell className="text-xs text-muted-foreground tabular-nums whitespace-nowrap">{new Date(j.created_at).toLocaleString()}</TableCell>
                      <TableCell className="font-mono text-xs">{j.job_type}</TableCell>
                      <TableCell className="text-muted-foreground">{j.stations?.name ?? "—"}</TableCell>
                      <TableCell><SyncStatusBadge status={mapJobStatus(j.status)} compact /></TableCell>
                      <TableCell className="text-xs text-muted-foreground max-w-xs truncate" title={j.message ?? ""}>{j.message ?? "—"}</TableCell>
                      <TableCell>{isEditor && j.status === "failed" && <Button variant="ghost" size="sm" onClick={() => retry.mutate(j)}><RefreshCw className="w-4 h-4 mr-1" />Retry</Button>}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </Card>
        </div>

        <Card className="p-5">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold text-sm">Timeline</h3>
            <Activity className="w-4 h-4 text-muted-foreground" />
          </div>
          <ol className="relative border-l border-border ml-2 space-y-4">
            {(filtered.slice(0, 30)).map((j: any) => {
              const Icon = statusIcon[j.status as keyof typeof statusIcon] ?? Clock;
              const color = statusColor[j.status as keyof typeof statusColor] ?? "text-muted-foreground";
              return (
                <li key={j.id} className="ml-4">
                  <span className="absolute -left-[7px] flex items-center justify-center w-3 h-3 rounded-full bg-background border border-border">
                    <Icon className={`w-2.5 h-2.5 ${color}`} />
                  </span>
                  <div className="text-xs text-muted-foreground tabular-nums">{new Date(j.created_at).toLocaleString()}</div>
                  <div className="text-sm font-medium font-mono">{j.job_type}</div>
                  <div className="text-xs text-muted-foreground">{j.stations?.name ?? "—"} · <span className={color}>{j.status}</span></div>
                  {j.message && <div className="text-xs text-muted-foreground mt-0.5 line-clamp-2">{j.message}</div>}
                </li>
              );
            })}
            {!filtered.length && !jobs.isLoading && <li className="text-xs text-muted-foreground italic ml-4">No events</li>}
          </ol>
        </Card>
      </div>
    </ResourcePageShell>
  );
}
