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
  const query = useQuery({
    queryKey: ["service-health"],
    refetchInterval: 10_000,
    queryFn: async () => {
      const { data, error } = await supabase.from("service_health").select("*, stations(name)").order("reported_at", { ascending: false }).limit(200);
      if (error) throw error;
      return data ?? [];
    },
  });

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
