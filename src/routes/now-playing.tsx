import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { database } from "@/services/database";
import { AppLayout } from "@/components/app-layout";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Activity, SkipForward, RotateCcw, Play, Square, Trash2, Loader2 } from "lucide-react";
import { EmptyState } from "@/components/data-states";
import { toast } from "sonner";
import {
  azuracastGetStatus, azuracastGetQueue, azuracastSkipSong, azuracastClearQueue,
  azuracastDeleteQueueItem, azuracastRuntimeAction,
} from "@/lib/azuracast-runtime.functions";

export const Route = createFileRoute("/now-playing")({ component: NowPlayingPage });

function NowPlayingPage() {
  const { data: stations } = useQuery({
    queryKey: ["stations-with-az"],
    queryFn: async () => {
      const { data } = await database
        .from("stations")
        .select("id,name,slug, azuracast_connections(id)")
        .order("name");
      return (data ?? []).filter((s: any) => s.azuracast_connections?.length);
    },
  });

  const { data: nowPlaying, isLoading } = useQuery({
    queryKey: ["now-playing-all"],
    refetchInterval: 5_000,
    queryFn: async () => {
      const { data } = await database.from("now_playing").select("*, stations(name,slug)").order("updated_at", { ascending: false });
      return data ?? [];
    },
  });
  const { data: history } = useQuery({
    queryKey: ["play-history"],
    refetchInterval: 15_000,
    queryFn: async () => {
      const { data } = await database.from("play_history").select("*, stations(name,slug)").order("played_at", { ascending: false }).limit(50);
      return data ?? [];
    },
  });

  const [selected, setSelected] = useState<string | null>(null);
  const stationId = selected ?? stations?.[0]?.id ?? null;

  return (
    <AppLayout title="Now Playing & Drift" description="Live track, queue control, and AzuraCast runtime actions">
      {(stations?.length ?? 0) > 1 && (
        <div className="mb-4 flex flex-wrap gap-2">
          {stations!.map((s: any) => (
            <Button
              key={s.id}
              variant={s.id === stationId ? "default" : "outline"}
              size="sm"
              onClick={() => setSelected(s.id)}
            >{s.name}</Button>
          ))}
        </div>
      )}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card className="p-4">
          <h2 className="text-sm font-semibold mb-3 flex items-center gap-2"><Activity className="w-4 h-4" /> Live</h2>
          {isLoading ? <div className="text-sm text-muted-foreground">Loading…</div>
            : (nowPlaying?.length ?? 0) === 0 ? <EmptyState title="No live data" description="Liquidsoap hasn't reported any tracks yet." />
            : <ul className="space-y-3">
                {nowPlaying!.map((np: any) => (
                  <li key={np.station_id} className="border border-border rounded-md p-3">
                    <div className="text-xs uppercase tracking-wider text-muted-foreground">{np.stations?.name ?? np.station_id}</div>
                    <div className="font-medium">{np.title ?? "—"}</div>
                    <div className="text-sm text-muted-foreground">{np.artist ?? ""} {np.album ? `· ${np.album}` : ""}</div>
                    <div className="text-xs text-muted-foreground mt-1">{np.listeners ?? 0} listeners · mount {np.mount_path ?? "—"}</div>
                  </li>
                ))}
              </ul>}
        </Card>

        {stationId ? <DriftPanel stationId={stationId} /> : (
          <Card className="p-6"><EmptyState title="No AzuraCast station" description="Add an AzuraCast connection to a station to see runtime controls." /></Card>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mt-4">
        {stationId && <QueuePanel stationId={stationId} />}
        <Card className="p-4">
          <h2 className="text-sm font-semibold mb-3">Recent History</h2>
          <div className="overflow-y-auto max-h-[60vh] divide-y divide-border">
            {(history ?? []).map((h: any) => (
              <div key={h.id} className="py-2 text-sm">
                <div className="flex justify-between">
                  <span className="font-medium">{h.title ?? "Unknown"}</span>
                  <span className="text-xs text-muted-foreground">{new Date(h.played_at).toLocaleTimeString()}</span>
                </div>
                <div className="text-xs text-muted-foreground">{h.artist ?? "—"} · {h.stations?.name ?? "?"}</div>
              </div>
            ))}
            {(history ?? []).length === 0 && <div className="text-sm text-muted-foreground py-4">No history yet.</div>}
          </div>
        </Card>
      </div>
    </AppLayout>
  );
}

function DriftPanel({ stationId }: { stationId: string }) {
  const getStatus = useServerFn(azuracastGetStatus);
  const skip = useServerFn(azuracastSkipSong);
  const action = useServerFn(azuracastRuntimeAction);
  const qc = useQueryClient();

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ["az-status", stationId],
    queryFn: () => getStatus({ data: { station_id: stationId } }),
    refetchInterval: 10_000,
  });

  const skipM = useMutation({
    mutationFn: () => skip({ data: { station_id: stationId } }),
    onSuccess: () => { toast.success("Skipped current song"); qc.invalidateQueries({ queryKey: ["az-queue", stationId] }); },
    onError: (e: any) => toast.error(e.message ?? "Skip failed"),
  });
  type RuntimeAction = "restart_station" | "frontend_start" | "frontend_stop" | "frontend_restart"
    | "backend_start" | "backend_stop" | "backend_restart" | "backend_disconnect";
  const actionM = useMutation({
    mutationFn: (a: RuntimeAction) => action({ data: { station_id: stationId, action: a } }),
    onSuccess: (_, a) => { toast.success(`Action "${a}" sent`); refetch(); },
    onError: (e: any) => toast.error(e.message ?? "Action failed"),
  });

  const status = data?.status as any;
  const isOnline = status?.backend_running && status?.frontend_running;

  return (
    <Card className="p-4">
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-sm font-semibold">AzuraCast Drift</h2>
        {isLoading ? <Loader2 className="w-4 h-4 animate-spin" /> :
          <Badge variant={isOnline ? "default" : "destructive"}>
            {isOnline ? "online" : "offline"}
          </Badge>}
      </div>

      {error ? <div className="text-sm text-destructive mb-3">{(error as Error).message}</div> : (
        <div className="grid grid-cols-2 gap-2 text-xs mb-4">
          <Stat label="Backend" value={status?.backend_running ? "running" : "stopped"} ok={!!status?.backend_running} />
          <Stat label="Frontend" value={status?.frontend_running ? "running" : "stopped"} ok={!!status?.frontend_running} />
        </div>
      )}

      <div className="grid grid-cols-2 gap-2">
        <Button size="sm" onClick={() => skipM.mutate()} disabled={skipM.isPending}>
          <SkipForward className="w-4 h-4 mr-1" /> Skip
        </Button>
        <Button size="sm" variant="outline" onClick={() => actionM.mutate("frontend_restart")} disabled={actionM.isPending}>
          <RotateCcw className="w-4 h-4 mr-1" /> Restart frontend
        </Button>
        <Button size="sm" variant="outline" onClick={() => actionM.mutate("backend_restart")} disabled={actionM.isPending}>
          <RotateCcw className="w-4 h-4 mr-1" /> Restart backend
        </Button>
        <Button size="sm" variant="outline" onClick={() => actionM.mutate("restart_station")} disabled={actionM.isPending}>
          <RotateCcw className="w-4 h-4 mr-1" /> Restart station
        </Button>
        <Button size="sm" variant={status?.frontend_running ? "destructive" : "default"}
          onClick={() => actionM.mutate(status?.frontend_running ? "frontend_stop" : "frontend_start")}
          disabled={actionM.isPending}>
          {status?.frontend_running ? <><Square className="w-4 h-4 mr-1" /> Stop frontend</> : <><Play className="w-4 h-4 mr-1" /> Start frontend</>}
        </Button>
        <Button size="sm" variant={status?.backend_running ? "destructive" : "default"}
          onClick={() => actionM.mutate(status?.backend_running ? "backend_stop" : "backend_start")}
          disabled={actionM.isPending}>
          {status?.backend_running ? <><Square className="w-4 h-4 mr-1" /> Stop backend</> : <><Play className="w-4 h-4 mr-1" /> Start backend</>}
        </Button>
      </div>
    </Card>
  );
}

function QueuePanel({ stationId }: { stationId: string }) {
  const getQueue = useServerFn(azuracastGetQueue);
  const clearQueue = useServerFn(azuracastClearQueue);
  const delItem = useServerFn(azuracastDeleteQueueItem);
  const qc = useQueryClient();

  const { data, isLoading, error } = useQuery({
    queryKey: ["az-queue", stationId],
    queryFn: () => getQueue({ data: { station_id: stationId } }),
    refetchInterval: 15_000,
  });

  const clearM = useMutation({
    mutationFn: () => clearQueue({ data: { station_id: stationId } }),
    onSuccess: () => { toast.success("Queue cleared"); qc.invalidateQueries({ queryKey: ["az-queue", stationId] }); },
    onError: (e: any) => toast.error(e.message ?? "Failed"),
  });
  const delM = useMutation({
    mutationFn: (id: string | number) => delItem({ data: { station_id: stationId, queue_id: id } }),
    onSuccess: () => { toast.success("Removed from queue"); qc.invalidateQueries({ queryKey: ["az-queue", stationId] }); },
    onError: (e: any) => toast.error(e.message ?? "Failed"),
  });

  const queue = (data?.queue ?? []) as any[];

  return (
    <Card className="p-4">
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-sm font-semibold">Upcoming Queue</h2>
        <Button size="sm" variant="outline" onClick={() => clearM.mutate()} disabled={clearM.isPending || queue.length === 0}>
          <Trash2 className="w-4 h-4 mr-1" /> Clear
        </Button>
      </div>
      {isLoading ? <div className="text-sm text-muted-foreground">Loading…</div>
        : error ? <div className="text-sm text-destructive">{(error as Error).message}</div>
        : queue.length === 0 ? <EmptyState title="Queue is empty" description="No upcoming tracks queued in AzuraCast." />
        : <div className="divide-y divide-border max-h-[60vh] overflow-y-auto">
            {queue.map((q: any, i: number) => (
              <div key={q.id ?? i} className="py-2 flex items-center justify-between gap-2">
                <div className="min-w-0">
                  <div className="text-sm font-medium truncate">{q.song?.title ?? q.title ?? "—"}</div>
                  <div className="text-xs text-muted-foreground truncate">{q.song?.artist ?? q.artist ?? ""} · {q.playlist ?? q.autodj_custom_uri ?? ""}</div>
                </div>
                {q.id != null && (
                  <Button size="sm" variant="ghost" onClick={() => delM.mutate(q.id)} disabled={delM.isPending}>
                    <Trash2 className="w-4 h-4" />
                  </Button>
                )}
              </div>
            ))}
          </div>}
    </Card>
  );
}

function Stat({ label, value, ok }: { label: string; value: string; ok: boolean }) {
  return (
    <div className="border border-border rounded p-2">
      <div className="text-muted-foreground uppercase tracking-wider text-[10px]">{label}</div>
      <div className={`font-medium ${ok ? "" : "text-destructive"}`}>{value}</div>
    </div>
  );
}
