import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { AppLayout } from "@/components/app-layout";
import { Card } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { StatusBadge } from "@/components/status-badge";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState, ErrorState } from "@/components/data-states";
import { RefreshCw, Activity, CheckCircle2, XCircle, Clock, PlayCircle } from "lucide-react";
import { useAuth } from "@/lib/auth";
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

function SyncJobsPage() {
  const qc = useQueryClient();
  const { isEditor } = useAuth();
  const [filter, setFilter] = useState<string>("all");
  const [q, setQ] = useState("");

  const jobs = useQuery({
    queryKey:["sync_jobs"],
    queryFn: async () => {
      const { data, error } = await supabase.from("sync_jobs").select("*, stations(name)").order("created_at", { ascending: false }).limit(200);
      if (error) throw error;
      return data ?? [];
    },
    refetchInterval: 10_000,
  });

  const filtered = useMemo(() => (jobs.data ?? []).filter((j: any) => {
    if (filter !== "all" && j.status !== filter) return false;
    if (q && !`${j.job_type} ${j.message ?? ""} ${j.stations?.name ?? ""}`.toLowerCase().includes(q.toLowerCase())) return false;
    return true;
  }), [jobs.data, filter, q]);

  const retry = useMutation({
    mutationFn: async (j: any) => {
      const { error } = await supabase.from("sync_jobs").insert({ station_id: j.station_id, job_type: j.job_type, status: "pending", payload: j.payload });
      if (error) throw error;
    },
    onSuccess: () => { toast.success("Re-queued"); qc.invalidateQueries({ queryKey:["sync_jobs"] }); },
    onError: (e: any) => toast.error(e.message),
  });

  return (
    <AppLayout title="Sync Jobs" description="Background sync between Radio Core and AzuraCast. Auto-refreshes every 10s." actions={
      <Button variant="outline" size="sm" onClick={() => jobs.refetch()}><RefreshCw className="w-4 h-4 mr-1" />Refresh</Button>
    }>
      <Card className="p-3 mb-4 flex gap-3 flex-wrap items-center">
        <Input className="max-w-sm" placeholder="Search type, station, message…" value={q} onChange={(e) => setQ(e.target.value)} />
        <Select value={filter} onValueChange={setFilter}>
          <SelectTrigger className="w-44"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All statuses</SelectItem>
            <SelectItem value="pending">Pending</SelectItem>
            <SelectItem value="running">Running</SelectItem>
            <SelectItem value="completed">Completed</SelectItem>
            <SelectItem value="failed">Failed</SelectItem>
          </SelectContent>
        </Select>
        <div className="text-xs text-muted-foreground ml-auto">{filtered.length} job{filtered.length === 1 ? "" : "s"}</div>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="lg:col-span-2">
          <Card className="overflow-hidden">
            <Table>
              <TableHeader><TableRow><TableHead>Created</TableHead><TableHead>Type</TableHead><TableHead>Station</TableHead><TableHead>Status</TableHead><TableHead>Message</TableHead><TableHead className="w-24" /></TableRow></TableHeader>
              <TableBody>
                {jobs.isLoading && Array.from({ length: 6 }).map((_, i) => (
                  <TableRow key={i}>{Array.from({length:6}).map((__, j) => <TableCell key={j}><Skeleton className="h-4" /></TableCell>)}</TableRow>
                ))}
                {!jobs.isLoading && filtered.map((j: any) => (
                  <TableRow key={j.id}>
                    <TableCell className="text-xs text-muted-foreground tabular-nums whitespace-nowrap">{new Date(j.created_at).toLocaleString()}</TableCell>
                    <TableCell className="font-mono text-xs">{j.job_type}</TableCell>
                    <TableCell className="text-muted-foreground">{j.stations?.name ?? "—"}</TableCell>
                    <TableCell><StatusBadge status={j.status} /></TableCell>
                    <TableCell className="text-xs text-muted-foreground max-w-xs truncate" title={j.message ?? ""}>{j.message ?? "—"}</TableCell>
                    <TableCell>{isEditor && j.status === "failed" && <Button variant="ghost" size="sm" onClick={() => retry.mutate(j)}><RefreshCw className="w-4 h-4 mr-1" />Retry</Button>}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
            {!jobs.isLoading && !filtered.length && (
              <div className="p-8"><EmptyState icon={Activity} title="No sync jobs" description="Sync jobs appear here when you trigger media or playlist syncs." /></div>
            )}
            {jobs.error && <div className="p-4"><ErrorState error={jobs.error} onRetry={() => jobs.refetch()} /></div>}
          </Card>
        </div>

        <Card className="p-5">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold">Timeline</h3>
            <Activity className="w-4 h-4 text-muted-foreground" />
          </div>
          <ol className="relative border-l border-border ml-2 space-y-4">
            {(filtered.slice(0, 30)).map((j: any) => {
              const Icon = statusIcon[j.status as keyof typeof statusIcon] ?? Clock;
              const color = statusColor[j.status as keyof typeof statusColor] ?? "text-muted-foreground";
              return (
                <li key={j.id} className="ml-4">
                  <span className={`absolute -left-[7px] flex items-center justify-center w-3 h-3 rounded-full bg-background border border-border`}>
                    <Icon className={`w-2.5 h-2.5 ${color}`} />
                  </span>
                  <div className="text-xs text-muted-foreground tabular-nums">{new Date(j.created_at).toLocaleString()}</div>
                  <div className="text-sm font-medium font-mono">{j.job_type}</div>
                  <div className="text-xs text-muted-foreground">{j.stations?.name ?? "—"} · <span className={color}>{j.status}</span></div>
                  {j.message && <div className="text-xs text-muted-foreground mt-0.5 line-clamp-2">{j.message}</div>}
                </li>
              );
            })}
            {!filtered.length && !jobs.isLoading && <li className="text-xs text-muted-foreground italic">No events</li>}
          </ol>
        </Card>
      </div>
    </AppLayout>
  );
}
