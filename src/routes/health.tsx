import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useMemo } from "react";
import { useServerFn } from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";
import { ResourcePageShell } from "@/components/resource-page-shell";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useStationScope } from "@/lib/station-context";
import { cn } from "@/lib/utils";
import { Server, AudioLines, Cloud, Settings2, Plug, Activity, type LucideIcon } from "lucide-react";
import { testRuntimeTarget } from "@/lib/runtime-targets.functions";
import { toast } from "sonner";

export const Route = createFileRoute("/health")({ component: HealthPage });

type Health = "ok" | "degraded" | "down" | "unknown";

const SERVICES: { key: string; label: string; icon: LucideIcon; plane: "Runtime" | "Control" }[] = [
  { key: "azuracast",   label: "AzuraCast",   icon: Plug,       plane: "Runtime" },
  { key: "liquidsoap",  label: "Liquidsoap",  icon: AudioLines, plane: "Runtime" },
  { key: "icecast",     label: "Icecast",     icon: Cloud,      plane: "Runtime" },
  { key: "stereo_tool", label: "Stereo Tool", icon: Settings2,  plane: "Runtime" },
  { key: "worker",      label: "Sync Worker", icon: Server,     plane: "Control" },
];

function classify(s: string | null | undefined): Health {
  const v = (s ?? "").toLowerCase();
  if (v === "ok" || v === "healthy") return "ok";
  if (v === "degraded" || v === "warning") return "degraded";
  if (v === "down" || v === "error" || v === "failed") return "down";
  return "unknown";
}

function HealthPage() {
  const { scope } = useStationScope();
  const qc = useQueryClient();
  const query = useQuery({
    queryKey: ["service-health"],
    refetchInterval: 10_000,
    queryFn: async () => {
      const { data, error } = await supabase.from("service_health").select("*, stations(name)").order("reported_at", { ascending: false }).limit(200);
      if (error) throw error;
      return data ?? [];
    },
  });

  const targetsQuery = useQuery({
    queryKey: ["runtime-targets-health"],
    refetchInterval: 30_000,
    queryFn: async () => {
      const [t, s] = await Promise.all([
        supabase.from("runtime_targets").select("*").order("name"),
        supabase.from("stations").select("id,name"),
      ]);
      if (t.error) throw t.error;
      if (s.error) throw s.error;
      const map = new Map((s.data ?? []).map((x) => [x.id, x.name]));
      return (t.data ?? []).map((row) => ({ ...row, station_name: map.get(row.station_id) ?? null }));
    },
  });

  const checksQuery = useQuery({
    queryKey: ["runtime-health-checks"],
    refetchInterval: 30_000,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("runtime_health_checks")
        .select("*")
        .order("started_at", { ascending: false })
        .limit(50);
      if (error) throw error;
      return data ?? [];
    },
  });

  const testFn = useServerFn(testRuntimeTarget);
  const test = useMutation({
    mutationFn: (id: string) => testFn({ data: { id } }),
    onSuccess: (r: { ok: boolean; message: string; duration_ms: number }) => {
      if (r.ok) toast.success(`OK (${r.duration_ms}ms): ${r.message}`);
      else toast.error(`Failed: ${r.message}`);
      qc.invalidateQueries({ queryKey: ["runtime-targets-health"] });
      qc.invalidateQueries({ queryKey: ["runtime-health-checks"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const visibleTargets = useMemo(() => {
    const rows = targetsQuery.data ?? [];
    return scope.kind === "station" ? rows.filter((r: any) => r.station_id === scope.station.id) : rows;
  }, [targetsQuery.data, scope]);

  const targetsByStation = useMemo(() => {
    const map = new Map<string, { name: string; rows: any[] }>();
    for (const t of visibleTargets) {
      const sid = t.station_id ?? "—";
      const sname = t.station_name ?? "Unassigned";
      if (!map.has(sid)) map.set(sid, { name: sname, rows: [] });
      map.get(sid)!.rows.push(t);
    }
    return Array.from(map.entries());
  }, [visibleTargets]);

  const visible = useMemo(() => (query.data ?? []).filter((r: any) =>
    scope.kind === "station" ? r.station_id === scope.station.id || r.station_id === null : true
  ), [query.data, scope]);

  const latest: Record<string, any> = {};
  visible.forEach((r: any) => { if (!latest[r.service]) latest[r.service] = r; });

  const state =
    query.isLoading ? { kind: "loading" as const } :
    query.error ? { kind: "error" as const, message: (query.error as Error).message, retry: () => query.refetch() } :
    { kind: "ready" as const };

  return (
    <ResourcePageShell
      title="Service Health"
      description="Heartbeats from runtime services and the control-plane worker."
      state={{ kind: "ready" }}
      wrapContent={false}
    >
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3 mb-4">
        {SERVICES.map(({ key, label, icon: Icon, plane }) => {
          const r = latest[key];
          const h = classify(r?.status);
          return (
            <Card key={key} className="p-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Icon className="w-4 h-4 text-muted-foreground" />
                  <div className="text-sm font-medium">{label}</div>
                </div>
                <span className={cn("w-2 h-2 rounded-full", healthDot(h))} title={h} />
              </div>
              <div className="mt-2 text-xs text-muted-foreground truncate" title={r?.message ?? ""}>{r?.message ?? "Awaiting first heartbeat"}</div>
              <div className="mt-2 flex items-center justify-between">
                <Badge variant="outline" className="text-[9px] uppercase tracking-wider">{plane}</Badge>
                <span className="text-[10px] uppercase tracking-wider text-muted-foreground">
                  {r ? new Date(r.reported_at).toLocaleTimeString() : "—"}
                </span>
              </div>
            </Card>
          );
        })}
      </div>

      <Card className="p-5 mb-4">
        <div className="flex items-center justify-between mb-3">
          <div>
            <h2 className="text-sm font-semibold">Runtime targets</h2>
            <p className="text-xs text-muted-foreground">External services connected to this control plane.</p>
          </div>
          <Button asChild size="sm" variant="outline">
            <Link to="/runtime-targets">Manage targets</Link>
          </Button>
        </div>
        {targetsQuery.isLoading && <div className="text-sm text-muted-foreground py-4">Loading runtime targets…</div>}
        {targetsQuery.error && <div className="text-sm text-destructive py-4">{(targetsQuery.error as Error).message}</div>}
        {!targetsQuery.isLoading && targetsByStation.length === 0 && (
          <div className="text-sm text-muted-foreground py-4">
            No runtime targets registered.{" "}
            <Link to="/runtime-targets" className="underline">Add one</Link>.
          </div>
        )}
        <div className="space-y-4">
          {targetsByStation.map(([sid, group]) => (
            <div key={sid}>
              <div className="text-[10px] uppercase tracking-wider text-muted-foreground mb-2">{group.name}</div>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {group.rows.map((t: any) => {
                  const lastCheck = (checksQuery.data ?? []).find((c: any) => c.target_id === t.id);
                  const np = (lastCheck?.details as { nowPlaying?: { title?: string|null; artist?: string|null } } | null | undefined)?.nowPlaying ?? null;
                  return (
                    <Card key={t.id} className="p-3">
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <div className="flex items-center gap-2">
                            <Plug className="w-3.5 h-3.5 text-muted-foreground" />
                            <span className="font-medium text-sm truncate">{t.name}</span>
                          </div>
                          <div className="mt-1 flex flex-wrap items-center gap-1">
                            <Badge variant="outline" className="text-[9px] uppercase">{t.type}</Badge>
                            <Badge variant="outline" className={cn("text-[9px] uppercase", targetStatusClass(t.status))}>
                              {t.status}
                            </Badge>
                          </div>
                        </div>
                        <Button size="sm" variant="ghost" disabled={test.isPending} onClick={() => test.mutate(t.id)} title="Test connection">
                          <Activity className="w-3.5 h-3.5" />
                        </Button>
                      </div>
                      {np && (np.title || np.artist) && (
                        <div className="mt-2 text-xs">
                          <div className="text-muted-foreground text-[10px] uppercase tracking-wider">Now playing</div>
                          <div className="font-medium truncate">{np.title ?? "Unknown"}</div>
                          <div className="text-muted-foreground truncate">{np.artist ?? ""}</div>
                        </div>
                      )}
                      {t.last_error && t.status !== "ok" && (
                        <div className="mt-2 text-[11px] text-destructive truncate" title={t.last_error}>{t.last_error}</div>
                      )}
                      <div className="mt-2 text-[10px] text-muted-foreground">
                        {t.last_checked_at ? `Checked ${new Date(t.last_checked_at).toLocaleString()}` : "Never checked"}
                      </div>
                    </Card>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      </Card>

      <Card className="p-5">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-sm font-semibold">Recent heartbeats</h2>
          <Badge variant="outline" className="text-[10px]">{visible.length}</Badge>
        </div>
        {state.kind === "loading" && <div className="text-sm text-muted-foreground py-6">Loading…</div>}
        {state.kind === "error" && <div className="text-sm text-destructive py-6">{state.message}</div>}
        {state.kind === "ready" && visible.length === 0 && (
          <div className="text-sm text-muted-foreground py-6">No heartbeats yet.</div>
        )}
        {state.kind === "ready" && visible.length > 0 && (
          <div className="text-sm divide-y divide-border max-h-[55vh] overflow-y-auto">
            {visible.map((r: any) => {
              const h = classify(r.status);
              return (
                <div key={r.id} className="py-2 flex items-center justify-between gap-2">
                  <div className="min-w-0 flex items-center gap-2">
                    <span className={cn("w-1.5 h-1.5 rounded-full", healthDot(h))} />
                    <span className="font-medium">{r.service}</span>
                    <span className="text-xs text-muted-foreground">· {r.stations?.name ?? "global"}</span>
                  </div>
                  <div className="text-xs text-muted-foreground tabular-nums">
                    {new Date(r.reported_at).toLocaleTimeString()}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </Card>
    </ResourcePageShell>
  );
}

function healthDot(h: Health) {
  return h === "ok" ? "bg-success"
    : h === "degraded" ? "bg-warning"
    : h === "down" ? "bg-destructive"
    : "bg-muted-foreground/40";
}

function targetStatusClass(s: string | null | undefined) {
  switch (s) {
    case "ok":       return "bg-success/15 text-success border-success/30";
    case "degraded": return "bg-warning/15 text-warning border-warning/30";
    case "down":
    case "error":    return "bg-destructive/15 text-destructive border-destructive/30";
    default:         return "bg-muted text-muted-foreground border-border";
  }
}
