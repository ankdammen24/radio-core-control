/**
 * Radio Core dashboard — control-room landing page.
 *
 * White-label safe: all station-specific data is read from the active
 * station scope. No hardcoded brand copy. Defensive queries: missing
 * tables/rows render neutral states instead of inventing data.
 */
import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { AppLayout } from "@/components/app-layout";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { useStationScope } from "@/lib/station-context";
import {
  Radio, Music, ListMusic, RefreshCw, Activity, ScrollText, AlertTriangle,
  HardDrive, Plus, Mic, Server, ArrowUpRight, Headphones,
} from "lucide-react";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/")({ component: Dashboard });

function Dashboard() {
  const { scope } = useStationScope();
  const stationId = scope.kind === "station" ? scope.station.id : null;
  const stationName = scope.kind === "station" ? scope.station.name : "All stations";

  const { data, isLoading } = useQuery({
    queryKey: ["dashboard", stationId ?? "all"],
    queryFn: async () => {
      const sFilter = <T extends { eq: (k: string, v: string) => T }>(q: T) =>
        stationId ? q.eq("station_id", stationId) : q;

      const [
        stations, media, missing, playlists, voicetracks, ads,
        runtimeTargets, syncFailed, syncSucceeded, syncQueued,
        storage, audit,
      ] = await Promise.all([
        supabase.from("stations").select("*", { count: "exact", head: true }).eq("is_active", true),
        sFilter(supabase.from("media_files").select("*", { count: "exact", head: true })),
        sFilter(supabase.from("media_files").select("*", { count: "exact", head: true }).eq("status", "missing_metadata")),
        sFilter(supabase.from("playlists").select("*", { count: "exact", head: true }).eq("is_active", true)),
        sFilter(supabase.from("voicetracks").select("*", { count: "exact", head: true })),
        sFilter(supabase.from("ads").select("*", { count: "exact", head: true })),
        sFilter(supabase.from("runtime_targets").select("id,name,type,status,is_active,last_check_at,station_id")).then((r) => r),
        sFilter(supabase.from("sync_jobs").select("*", { count: "exact", head: true }).eq("status", "failed")),
        sFilter(supabase.from("sync_jobs").select("*", { count: "exact", head: true }).eq("status", "succeeded")),
        sFilter(supabase.from("sync_jobs").select("*", { count: "exact", head: true }).in("status", ["pending", "running"])),
        sFilter(supabase.from("storage_objects").select("size_bytes,bucket_type")).then((r) => r),
        supabase.from("audit_logs").select("*").order("created_at", { ascending: false }).limit(8),
      ]);

      const targets = (runtimeTargets.data ?? []).filter((r) => r.is_active);
      const tStat = (s: string) => targets.filter((t) => t.status === s).length;

      const objs = storage.data ?? [];
      const totalBytes = objs.reduce((a, o) => a + (o.size_bytes ?? 0), 0);
      const byBucket = objs.reduce<Record<string, number>>((acc, o) => {
        acc[o.bucket_type] = (acc[o.bucket_type] ?? 0) + (o.size_bytes ?? 0);
        return acc;
      }, {});

      return {
        stations: stations.count ?? 0,
        media: media.count ?? 0,
        missing: missing.count ?? 0,
        playlists: playlists.count ?? 0,
        voicetracks: voicetracks.count ?? 0,
        ads: ads.count ?? 0,
        targets,
        targetsTotal: targets.length,
        targetsOk: tStat("ok"),
        targetsDegraded: tStat("degraded"),
        targetsDown: tStat("down") + tStat("error"),
        syncFailed: syncFailed.count ?? 0,
        syncSucceeded: syncSucceeded.count ?? 0,
        syncQueued: syncQueued.count ?? 0,
        storageBytes: totalBytes,
        storageByBucket: byBucket,
        objectCount: objs.length,
        audit: audit.data ?? [],
      };
    },
    refetchInterval: 30_000,
  });

  const onAir = !!data && data.targetsTotal > 0 && data.targetsDown === 0;
  const offAir = !!data && data.targetsTotal > 0 && data.targetsOk === 0;
  const degraded = !!data && data.targetsTotal > 0 && data.targetsDegraded > 0 && !offAir;

  return (
    <AppLayout
      title="Operations"
      description={`Live overview · ${stationName}`}
      actions={
        <Button asChild size="sm" variant="outline">
          <Link to={"/runtime-targets" as "/"}>
            <Server className="w-4 h-4 mr-1.5" /> Manage runtimes
          </Link>
        </Button>
      }
    >
      {/* Hero / On-air */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <Card className="lg:col-span-2 p-0 overflow-hidden relative">
          <div className="grid-overlay absolute inset-0 pointer-events-none opacity-60" />
          <div className="relative p-6 flex flex-col sm:flex-row gap-6 items-start sm:items-center justify-between">
            <div className="flex items-center gap-4">
              <div
                className={cn(
                  "w-14 h-14 rounded-xl flex items-center justify-center",
                  onAir   ? "bg-onair text-onair-foreground onair-pulse" :
                  degraded ? "bg-warning text-warning-foreground" :
                  offAir  ? "bg-destructive text-destructive-foreground" :
                            "bg-muted text-muted-foreground",
                )}
              >
                <Radio className="w-7 h-7" />
              </div>
              <div>
                <div className="text-[10px] uppercase tracking-[0.25em] text-muted-foreground">Status</div>
                <div className="text-2xl font-semibold tracking-tight">
                  {isLoading ? "Checking…" :
                    data!.targetsTotal === 0 ? "No runtime targets" :
                    onAir   ? "On Air" :
                    degraded ? "Degraded broadcast" :
                    offAir  ? "Off Air" : "Unknown"}
                </div>
                <div className="text-sm text-muted-foreground mt-0.5">
                  {data
                    ? `${data.targetsOk}/${data.targetsTotal} runtime targets healthy`
                    : "—"}
                </div>
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <Button asChild size="sm">
                <Link to={"/health" as "/"}>
                  <Activity className="w-4 h-4 mr-1.5" /> Health
                </Link>
              </Button>
              <Button asChild size="sm" variant="outline">
                <Link to={"/now-playing" as "/"}>
                  <Headphones className="w-4 h-4 mr-1.5" /> Now Playing
                </Link>
              </Button>
            </div>
          </div>
        </Card>

        {/* Now Playing card */}
        <Card className="p-5">
          <div className="flex items-center justify-between mb-3">
            <div>
              <div className="text-[10px] uppercase tracking-widest text-muted-foreground">Now Playing</div>
              <div className="text-sm font-semibold tracking-tight">Live metadata</div>
            </div>
            <Activity className="w-4 h-4 text-muted-foreground" />
          </div>
          <div className="rounded-md border border-dashed border-border p-4 text-center text-xs text-muted-foreground">
            Live now-playing data appears here once a runtime target reports it.
            <div className="mt-2">
              <Link to={"/runtime-targets" as "/"} className="text-primary hover:underline">Configure targets →</Link>
            </div>
          </div>
        </Card>
      </div>

      {/* KPI strip */}
      <div className="mt-4 grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
        <Kpi icon={Radio}    label="Stations"    value={isLoading ? "—" : data!.stations} />
        <Kpi icon={Music}    label="Media"       value={isLoading ? "—" : data!.media} />
        <Kpi icon={ListMusic} label="Playlists"  value={isLoading ? "—" : data!.playlists} />
        <Kpi icon={Mic}      label="Voicetracks" value={isLoading ? "—" : data!.voicetracks} />
        <Kpi icon={AlertTriangle} label="Missing meta" value={isLoading ? "—" : data!.missing} tone={data?.missing ? "warn" : "ok"} />
        <Kpi icon={RefreshCw} label="Failed jobs" value={isLoading ? "—" : data!.syncFailed} tone={data?.syncFailed ? "error" : "ok"} />
      </div>

      {/* Runtime + Sync + Storage */}
      <div className="mt-4 grid grid-cols-1 lg:grid-cols-3 gap-4">
        <Card className="p-5">
          <SectionHeader icon={Server} title="Runtime Targets" linkTo="/runtime-targets" />
          {isLoading ? (
            <Skel rows={3} />
          ) : data!.targets.length === 0 ? (
            <EmptyHint label="No targets configured." actionTo="/runtime-targets" actionLabel="Add target" />
          ) : (
            <ul className="space-y-2">
              {data!.targets.slice(0, 5).map((t) => (
                <li key={t.id} className="flex items-center justify-between gap-3 rounded-md border border-border bg-muted/20 px-3 py-2">
                  <div className="min-w-0">
                    <div className="text-sm font-medium truncate">{t.name}</div>
                    <div className="text-[10px] uppercase tracking-wider text-muted-foreground">{t.type}</div>
                  </div>
                  <StatusDot status={String(t.status ?? "")} />
                </li>
              ))}
            </ul>
          )}
        </Card>

        <Card className="p-5">
          <SectionHeader icon={RefreshCw} title="Sync Jobs" linkTo="/sync-jobs" />
          {isLoading ? <Skel rows={3} /> : (
            <div className="space-y-3">
              <SyncRow label="Queued / running" value={data!.syncQueued} tone="info" />
              <SyncRow label="Succeeded" value={data!.syncSucceeded} tone="success" />
              <SyncRow label="Failed" value={data!.syncFailed} tone={data!.syncFailed ? "error" : "muted"} />
            </div>
          )}
        </Card>

        <Card className="p-5">
          <SectionHeader icon={HardDrive} title="Storage" linkTo="/r2-storage" />
          {isLoading ? <Skel rows={3} /> : data!.objectCount === 0 ? (
            <EmptyHint label="No objects stored yet." actionTo="/r2-storage" actionLabel="Upload" />
          ) : (
            <div className="space-y-3">
              <div className="flex items-baseline justify-between">
                <div className="text-2xl font-semibold tabular-nums">{formatBytes(data!.storageBytes)}</div>
                <div className="text-[10px] uppercase tracking-wider text-muted-foreground">{data!.objectCount} objects</div>
              </div>
              {Object.entries(data!.storageByBucket).map(([k, v]) => {
                const pct = data!.storageBytes ? Math.round((v / data!.storageBytes) * 100) : 0;
                return (
                  <div key={k} className="space-y-1">
                    <div className="flex items-center justify-between text-xs">
                      <span className="capitalize text-muted-foreground">{k}</span>
                      <span className="tabular-nums">{formatBytes(v)}</span>
                    </div>
                    <Progress value={pct} className="h-1.5" />
                  </div>
                );
              })}
            </div>
          )}
        </Card>
      </div>

      {/* Alerts + Quick actions */}
      <div className="mt-4 grid grid-cols-1 lg:grid-cols-3 gap-4">
        <Card className="p-5 lg:col-span-2">
          <SectionHeader icon={ScrollText} title="Recent Activity" linkTo="/audit" />
          {isLoading ? <Skel rows={4} /> :
            data!.audit.length === 0 ? (
              <div className="text-sm text-muted-foreground">No recent activity.</div>
            ) : (
              <ul className="divide-y divide-border">
                {data!.audit.map((a) => (
                  <li key={a.id} className="flex items-start justify-between gap-3 py-2.5">
                    <div className="min-w-0">
                      <div className="text-sm font-medium truncate">{a.action}</div>
                      <div className="text-[11px] text-muted-foreground truncate">
                        {a.entity_type ?? "system"} · {a.user_id ? `by ${String(a.user_id).slice(0, 8)}…` : "system"}
                      </div>
                    </div>
                    <div className="text-[10px] text-muted-foreground whitespace-nowrap">
                      {new Date(a.created_at).toLocaleString()}
                    </div>
                  </li>
                ))}
              </ul>
            )}
        </Card>

        <Card className="p-5">
          <div className="flex items-center justify-between mb-3">
            <div className="text-sm font-semibold">Quick actions</div>
            <Plus className="w-4 h-4 text-muted-foreground" />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <QuickAction to="/media" label="Media" icon={Music} />
            <QuickAction to="/playlists" label="Playlists" icon={ListMusic} />
            <QuickAction to="/voicetracks" label="Voicetracks" icon={Mic} />
            <QuickAction to="/ads" label="Ads" icon={Activity} />
            <QuickAction to="/runtime-targets" label="Runtimes" icon={Server} />
            <QuickAction to="/health" label="Health" icon={Activity} />
          </div>
        </Card>
      </div>
    </AppLayout>
  );
}

/* ──────────────────────────────────────────────────────────── helpers ── */

function Kpi({ icon: Icon, label, value, tone }: { icon: any; label: string; value: number | string; tone?: "ok" | "warn" | "error" }) {
  const cls =
    tone === "error" ? "text-destructive" :
    tone === "warn"  ? "text-warning" :
    "text-foreground";
  return (
    <Card className="p-4">
      <div className="flex items-center justify-between">
        <div className="text-[10px] uppercase tracking-widest text-muted-foreground">{label}</div>
        <Icon className="w-3.5 h-3.5 text-muted-foreground" />
      </div>
      <div className={cn("mt-2 text-2xl font-semibold tabular-nums", cls)}>{value}</div>
    </Card>
  );
}

function SectionHeader({ icon: Icon, title, linkTo }: { icon: any; title: string; linkTo: string }) {
  return (
    <div className="flex items-center justify-between mb-3">
      <div className="flex items-center gap-2">
        <Icon className="w-4 h-4 text-muted-foreground" />
        <div className="text-sm font-semibold">{title}</div>
      </div>
      <Link to={linkTo as "/"} className="text-[11px] uppercase tracking-wider text-muted-foreground hover:text-foreground inline-flex items-center gap-1">
        View <ArrowUpRight className="w-3 h-3" />
      </Link>
    </div>
  );
}

function Skel({ rows = 3 }: { rows?: number }) {
  return (
    <div className="space-y-2">
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="h-9 rounded-md bg-muted/50 animate-pulse" />
      ))}
    </div>
  );
}

function EmptyHint({ label, actionTo, actionLabel }: { label: string; actionTo: string; actionLabel: string }) {
  return (
    <div className="rounded-md border border-dashed border-border p-4 text-center text-xs text-muted-foreground">
      {label}
      <div className="mt-2">
        <Link to={actionTo as "/"} className="text-primary hover:underline">{actionLabel} →</Link>
      </div>
    </div>
  );
}

function StatusDot({ status }: { status: string }) {
  const tone =
    status === "ok" ? "bg-success" :
    status === "degraded" ? "bg-warning" :
    status === "down" || status === "error" ? "bg-destructive" :
    "bg-muted-foreground/40";
  const label =
    status === "ok" ? "Healthy" :
    status === "degraded" ? "Degraded" :
    status === "down" ? "Down" :
    status === "error" ? "Error" :
    status || "Unknown";
  return (
    <Badge variant="outline" className="gap-1.5 text-[10px] uppercase tracking-wider">
      <span className={cn("w-1.5 h-1.5 rounded-full", tone)} />
      {label}
    </Badge>
  );
}

function SyncRow({ label, value, tone }: { label: string; value: number; tone: "success" | "error" | "info" | "muted" }) {
  const dot =
    tone === "success" ? "bg-success" :
    tone === "error"   ? "bg-destructive" :
    tone === "info"    ? "bg-info" :
    "bg-muted-foreground/40";
  return (
    <div className="flex items-center justify-between rounded-md border border-border bg-muted/20 px-3 py-2">
      <div className="flex items-center gap-2 text-sm">
        <span className={cn("w-1.5 h-1.5 rounded-full", dot)} />
        {label}
      </div>
      <div className="text-sm font-semibold tabular-nums">{value}</div>
    </div>
  );
}

function QuickAction({ to, label, icon: Icon }: { to: string; label: string; icon: any }) {
  return (
    <Link
      to={to as "/"}
      className="group flex flex-col items-start gap-1.5 rounded-md border border-border bg-muted/30 px-3 py-2.5 hover:border-primary/40 hover:bg-muted/60 transition-colors"
    >
      <Icon className="w-4 h-4 text-muted-foreground group-hover:text-primary transition-colors" />
      <div className="text-xs font-medium">{label}</div>
    </Link>
  );
}

function formatBytes(b: number) {
  if (!b) return "0 B";
  const u = ["B", "KB", "MB", "GB", "TB"];
  let i = 0; let n = b;
  while (n >= 1024 && i < u.length - 1) { n /= 1024; i++; }
  return `${n.toFixed(n >= 100 || i === 0 ? 0 : 1)} ${u[i]}`;
}
