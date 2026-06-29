/**
 * Studio Cockpit — operator home screen for one station.
 *
 * Stage 0 scaffold: layout, components and data shapes are real, but most
 * data sources are mocked through small adapter helpers. Each panel is
 * built so it can be wired to a real server function later without UI
 * changes (TODO markers point to the future binding).
 *
 * Architecture rules respected:
 *   - Control plane only (no direct calls to AzuraCast / Liquidsoap / Icecast).
 *   - Runtime states are plain data — components don't know the runtime.
 *   - White-label safe — all branding flows from the active station.
 */
import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useMemo } from "react";
import { AppLayout } from "@/components/app-layout";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { SyncStatusBadge, type SyncStatus } from "@/components/sync-status-badge";
import { useActiveStation, useStationScope } from "@/lib/station-context";
import { database } from "@/services/database";
import { cn } from "@/lib/utils";
import {
  Activity, SkipForward, RotateCw, Radio, Headphones, Music, ListMusic,
  Zap, Cloud, Server, AudioLines, Settings2, AlertTriangle, CheckCircle2,
  ListPlus, ShieldAlert, CircleDot,
} from "lucide-react";

export const Route = createFileRoute("/cockpit")({ component: CockpitPage });

// ---------------------------------------------------------------------------
// Types — stable shapes the cockpit reads. Runtime adapters fill these in.
// ---------------------------------------------------------------------------

type RuntimeHealth = "ok" | "degraded" | "down" | "unknown";

type ServiceStatus = {
  service: "azuracast" | "liquidsoap" | "icecast" | "stereo_tool";
  health: RuntimeHealth;
  detail: string;
  // TODO: bind to service_health table via server fn.
};

type NowPlayingTrack = {
  title: string;
  artist: string;
  album?: string | null;
  startedAt: string;
  durationSec: number;
  elapsedSec: number;
};

type QueueItem = { id: string; position: number; title: string; artist: string; source: string };

type SyncJobSummary = {
  id: string;
  jobType: string;
  status: SyncStatus;
  updatedAt: string;
};

type RuntimeError = { id: string; at: string; service: string; message: string };

// ---------------------------------------------------------------------------

function CockpitPage() {
  const { scope } = useStationScope();
  const station = useActiveStation();

  if (scope.kind === "none") {
    return (
      <AppLayout title="Studio Cockpit" description="Operational home for the active station">
        <Card className="p-12 text-center text-sm text-muted-foreground">
          Pick a station from the switcher to open the cockpit.
        </Card>
      </AppLayout>
    );
  }

  if (scope.kind === "all") {
    return (
      <AppLayout title="Studio Cockpit" description="Operational home for the active station">
        <Card className="p-12 text-center text-sm text-muted-foreground">
          Cockpit is per-station. Select a single station from the switcher.
        </Card>
      </AppLayout>
    );
  }

  return <CockpitForStation key={station!.id} />;
}

function CockpitForStation() {
  const station = useActiveStation()!;

  // Live now_playing row from DB (control-plane mirror of runtime).
  const { data: nowPlayingRow } = useQuery({
    queryKey: ["cockpit", "now_playing", station.id],
    refetchInterval: 5_000,
    queryFn: async () => {
      const { data } = await database
        .from("now_playing")
        .select("*")
        .eq("station_id", station.id)
        .maybeSingle();
      return data;
    },
  });

  // Recent sync jobs for this station — real data.
  const { data: jobsRaw } = useQuery({
    queryKey: ["cockpit", "sync_jobs", station.id],
    refetchInterval: 10_000,
    queryFn: async () => {
      const { data } = await database
        .from("sync_jobs")
        .select("id,job_type,status,created_at,finished_at")
        .eq("station_id", station.id)
        .order("created_at", { ascending: false })
        .limit(6);
      return data ?? [];
    },
  });

  // Recent service health rows — real data when present.
  const { data: healthRows } = useQuery({
    queryKey: ["cockpit", "service_health", station.id],
    refetchInterval: 15_000,
    queryFn: async () => {
      const { data } = await database
        .from("service_health")
        .select("*")
        .eq("station_id", station.id)
        .order("reported_at", { ascending: false })
        .limit(20);
      return data ?? [];
    },
  });

  const nowPlaying = useMemo<NowPlayingTrack | null>(() => {
    if (!nowPlayingRow) return null;
    const r = nowPlayingRow as Record<string, unknown>;
    const title = (r.title as string) || (r.song_title as string) || "Untitled";
    const artist = (r.artist as string) || (r.song_artist as string) || "Unknown artist";
    const album = (r.album as string | null) ?? null;
    const startedAt = (r.started_at as string) || (r.updated_at as string) || new Date().toISOString();
    const durationSec = Number(r.duration ?? r.duration_sec ?? 0) || 0;
    const elapsedSec = Math.max(0, Math.floor((Date.now() - new Date(startedAt).getTime()) / 1000));
    return { title, artist, album, startedAt, durationSec, elapsedSec };
  }, [nowPlayingRow]);

  // ---- Mocked adapters (TODO: replace with server-fn bindings) ------------

  const queue: QueueItem[] = MOCK_QUEUE;
  const services: ServiceStatus[] = useMemo(() => buildServiceStatuses(healthRows), [healthRows]);
  const listenerCount = MOCK_LISTENERS;
  const fallbackActive = false;
  const liveTakeoverActive = false;
  const currentBlock = { name: "Daytime Rotation", kind: "playlist" as const };
  const errors: RuntimeError[] = MOCK_ERRORS;

  const jobs: SyncJobSummary[] = (jobsRaw ?? []).map((j) => ({
    id: j.id,
    jobType: j.job_type,
    status: mapSyncJobStatus(j.status),
    updatedAt: j.finished_at ?? j.created_at,
  }));

  return (
    <AppLayout
      title="Studio Cockpit"
      description={`Operational home for ${station.name}`}
      actions={
        <div className="flex items-center gap-2">
          <Badge variant="outline" className="uppercase tracking-wider text-[10px]">
            {station.slug}
          </Badge>
          <Button size="sm" variant="outline">
            <Settings2 className="w-4 h-4 mr-1.5" /> Station settings
          </Button>
        </div>
      }
    >
      <div className="grid grid-cols-12 gap-4">
        {/* Row 1 — Now Playing + Quick actions + Listener KPI */}
        <NowPlayingPanel className="col-span-12 lg:col-span-7" track={nowPlaying} stationName={station.name} />
        <QuickActionsPanel className="col-span-12 lg:col-span-5" />

        {/* Row 2 — Up next + Schedule + Listener / Fallback / Live */}
        <QueuePanel className="col-span-12 lg:col-span-5" items={queue} />
        <ScheduleBlockPanel className="col-span-12 lg:col-span-3" block={currentBlock} />
        <KpiStack
          className="col-span-12 lg:col-span-4"
          listenerCount={listenerCount}
          fallbackActive={fallbackActive}
          liveTakeoverActive={liveTakeoverActive}
        />

        {/* Row 3 — Service health */}
        <ServiceHealthPanel className="col-span-12" services={services} />

        {/* Row 4 — Recent sync jobs + Recent errors */}
        <RecentSyncJobsPanel className="col-span-12 lg:col-span-7" jobs={jobs} />
        <RecentErrorsPanel className="col-span-12 lg:col-span-5" errors={errors} />
      </div>
    </AppLayout>
  );
}

// ---------------------------------------------------------------------------
// Panels
// ---------------------------------------------------------------------------

function PanelHeader({ icon: Icon, title, hint, right }: {
  icon: typeof Radio; title: string; hint?: string; right?: React.ReactNode;
}) {
  return (
    <div className="flex items-start justify-between gap-2 mb-3">
      <div className="flex items-center gap-2">
        <Icon className="w-4 h-4 text-muted-foreground" />
        <div>
          <div className="text-sm font-semibold tracking-tight">{title}</div>
          {hint && <div className="text-[10px] uppercase tracking-wider text-muted-foreground">{hint}</div>}
        </div>
      </div>
      {right}
    </div>
  );
}

function NowPlayingPanel({ className, track, stationName }: {
  className?: string; track: NowPlayingTrack | null; stationName: string;
}) {
  const progress = track && track.durationSec > 0
    ? Math.min(100, (track.elapsedSec / track.durationSec) * 100) : 0;
  return (
    <Card className={cn("p-5", className)}>
      <PanelHeader
        icon={Activity}
        title="Now Playing"
        hint={stationName}
        right={<SyncStatusBadge status={track ? "synced" : "pending"} />}
      />
      {track ? (
        <>
          <div className="flex items-baseline gap-3">
            <div className="text-2xl font-semibold tracking-tight truncate">{track.title}</div>
          </div>
          <div className="text-sm text-muted-foreground truncate">
            {track.artist}{track.album ? ` — ${track.album}` : ""}
          </div>
          <div className="mt-4 h-1.5 rounded-full bg-muted overflow-hidden">
            <div className="h-full bg-accent transition-all" style={{ width: `${progress}%` }} />
          </div>
          <div className="mt-1.5 flex justify-between text-[10px] tabular-nums uppercase tracking-wider text-muted-foreground">
            <span>{formatTime(track.elapsedSec)}</span>
            <span>{formatTime(Math.max(0, track.durationSec - track.elapsedSec))}</span>
          </div>
        </>
      ) : (
        <div className="text-sm text-muted-foreground py-4">No track reported by runtime yet.</div>
      )}
    </Card>
  );
}

function QuickActionsPanel({ className }: { className?: string }) {
  // TODO: wire to azuracastRuntimeAction / azuracastSkipSong server fns.
  return (
    <Card className={cn("p-5", className)}>
      <PanelHeader icon={Zap} title="Quick actions" hint="Runtime control" />
      <div className="grid grid-cols-2 gap-2">
        <Button variant="outline" size="sm" className="justify-start">
          <SkipForward className="w-4 h-4 mr-2" /> Skip current
        </Button>
        <Button variant="outline" size="sm" className="justify-start">
          <ListPlus className="w-4 h-4 mr-2" /> Queue item
        </Button>
        <Button variant="outline" size="sm" className="justify-start">
          <Radio className="w-4 h-4 mr-2" /> Live takeover
        </Button>
        <Button variant="outline" size="sm" className="justify-start">
          <RotateCw className="w-4 h-4 mr-2" /> Reload runtime
        </Button>
      </div>
      <div className="mt-3 text-[10px] uppercase tracking-wider text-muted-foreground">
        All actions route via Radio Core server functions.
      </div>
    </Card>
  );
}

function QueuePanel({ className, items }: { className?: string; items: QueueItem[] }) {
  return (
    <Card className={cn("p-5", className)}>
      <PanelHeader
        icon={ListMusic}
        title="Up next"
        hint={`${items.length} queued`}
        right={<Badge variant="outline" className="text-[10px]">Mock</Badge>}
      />
      <ul className="space-y-2">
        {items.slice(0, 5).map((q) => (
          <li key={q.id} className="flex items-center gap-3 text-sm border-b border-border last:border-0 pb-2 last:pb-0">
            <span className="w-5 text-xs tabular-nums text-muted-foreground">{q.position}</span>
            <div className="min-w-0 flex-1">
              <div className="truncate font-medium">{q.title}</div>
              <div className="truncate text-xs text-muted-foreground">{q.artist}</div>
            </div>
            <Badge variant="outline" className="text-[9px] uppercase tracking-wider">{q.source}</Badge>
          </li>
        ))}
      </ul>
    </Card>
  );
}

function ScheduleBlockPanel({ className, block }: {
  className?: string; block: { name: string; kind: "playlist" | "show" | "live" };
}) {
  return (
    <Card className={cn("p-5", className)}>
      <PanelHeader icon={Music} title="Current block" hint={block.kind} />
      <div className="text-base font-medium truncate">{block.name}</div>
      <div className="mt-1 text-xs text-muted-foreground">Driven by schedule + rotation</div>
    </Card>
  );
}

function KpiStack({ className, listenerCount, fallbackActive, liveTakeoverActive }: {
  className?: string; listenerCount: number; fallbackActive: boolean; liveTakeoverActive: boolean;
}) {
  return (
    <div className={cn("grid grid-cols-2 gap-3", className)}>
      <KpiCard
        icon={Headphones}
        label="Listeners"
        value={listenerCount.toLocaleString()}
        hint="Across all mounts"
      />
      <KpiCard
        icon={Cloud}
        label="Stream"
        value="Online"
        tone="success"
        hint="Icecast accepts"
      />
      <KpiCard
        icon={ShieldAlert}
        label="Fallback"
        value={fallbackActive ? "Active" : "Standby"}
        tone={fallbackActive ? "warn" : "default"}
        hint={fallbackActive ? "Runtime fell back" : "Primary on air"}
      />
      <KpiCard
        icon={Radio}
        label="Live"
        value={liveTakeoverActive ? "On air" : "Off"}
        tone={liveTakeoverActive ? "info" : "default"}
        hint={liveTakeoverActive ? "Studio input active" : "Automation only"}
      />
    </div>
  );
}

function KpiCard({ icon: Icon, label, value, hint, tone = "default" }: {
  icon: typeof Radio; label: string; value: string; hint: string;
  tone?: "default" | "success" | "warn" | "info" | "error";
}) {
  const toneCls = {
    default: "text-foreground",
    success: "text-success",
    warn: "text-warning",
    info: "text-info",
    error: "text-destructive",
  }[tone];
  return (
    <Card className="p-4">
      <div className="flex items-center justify-between">
        <div className="text-[10px] uppercase tracking-wider text-muted-foreground">{label}</div>
        <Icon className="w-3.5 h-3.5 text-muted-foreground" />
      </div>
      <div className={cn("mt-1.5 text-xl font-semibold tabular-nums", toneCls)}>{value}</div>
      <div className="text-[10px] text-muted-foreground mt-0.5 truncate">{hint}</div>
    </Card>
  );
}

function ServiceHealthPanel({ className, services }: { className?: string; services: ServiceStatus[] }) {
  return (
    <Card className={cn("p-5", className)}>
      <PanelHeader icon={Server} title="Runtime health" hint="Control plane → runtime plane" />
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {services.map((s) => <ServiceTile key={s.service} status={s} />)}
      </div>
    </Card>
  );
}

function ServiceTile({ status }: { status: ServiceStatus }) {
  const meta = SERVICE_META[status.service];
  const dot = healthDotCls(status.health);
  const Icon = meta.icon;
  return (
    <div className="rounded-md border border-border p-3 bg-card">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Icon className="w-4 h-4 text-muted-foreground" />
          <div className="text-sm font-medium">{meta.label}</div>
        </div>
        <span className={cn("w-2 h-2 rounded-full", dot)} title={status.health} />
      </div>
      <div className="mt-1 text-[11px] text-muted-foreground truncate" title={status.detail}>
        {status.detail}
      </div>
      <div className="mt-2 flex items-center justify-between">
        <Badge variant="outline" className="text-[9px] uppercase tracking-wider">{meta.plane}</Badge>
        <span className="text-[10px] uppercase tracking-wider text-muted-foreground">{healthLabel(status.health)}</span>
      </div>
    </div>
  );
}

function RecentSyncJobsPanel({ className, jobs }: { className?: string; jobs: SyncJobSummary[] }) {
  return (
    <Card className={cn("p-5", className)}>
      <PanelHeader icon={CircleDot} title="Recent sync jobs" hint={`${jobs.length} entries`} />
      {jobs.length === 0 ? (
        <div className="text-sm text-muted-foreground py-4">No recent sync activity.</div>
      ) : (
        <ul className="space-y-2">
          {jobs.map((j) => (
            <li key={j.id} className="flex items-center justify-between gap-2 border-b border-border last:border-0 pb-2 last:pb-0">
              <div className="min-w-0">
                <div className="text-sm font-medium truncate">{j.jobType}</div>
                <div className="text-[10px] text-muted-foreground">{new Date(j.updatedAt).toLocaleString()}</div>
              </div>
              <SyncStatusBadge status={j.status} />
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}

function RecentErrorsPanel({ className, errors }: { className?: string; errors: RuntimeError[] }) {
  return (
    <Card className={cn("p-5", className)}>
      <PanelHeader
        icon={AlertTriangle}
        title="Recent errors"
        hint="Runtime + sync"
        right={errors.length === 0
          ? <Badge variant="outline" className="text-[10px] gap-1 text-success border-success/30 bg-success/10"><CheckCircle2 className="w-3 h-3" /> Clean</Badge>
          : <Badge variant="outline" className="text-[10px] text-destructive border-destructive/30 bg-destructive/10">{errors.length}</Badge>}
      />
      {errors.length === 0 ? (
        <div className="text-sm text-muted-foreground py-4">No errors in the last hour.</div>
      ) : (
        <ul className="space-y-2">
          {errors.slice(0, 5).map((e) => (
            <li key={e.id} className="border-l-2 border-destructive/60 pl-3">
              <div className="text-xs uppercase tracking-wider text-muted-foreground flex items-center gap-2">
                <span>{e.service}</span>
                <Separator orientation="vertical" className="h-3" />
                <span>{new Date(e.at).toLocaleTimeString()}</span>
              </div>
              <div className="text-sm">{e.message}</div>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const SERVICE_META: Record<ServiceStatus["service"], { label: string; icon: typeof Radio; plane: "Runtime" | "Control" }> = {
  azuracast:   { label: "AzuraCast",   icon: Plug,        plane: "Runtime" },
  liquidsoap:  { label: "Liquidsoap",  icon: AudioLines,  plane: "Runtime" },
  icecast:     { label: "Icecast",     icon: Cloud,       plane: "Runtime" },
  stereo_tool: { label: "Stereo Tool", icon: Settings2,   plane: "Runtime" },
};

import { Plug } from "lucide-react";

function healthDotCls(h: RuntimeHealth) {
  return h === "ok" ? "bg-success"
    : h === "degraded" ? "bg-warning"
    : h === "down" ? "bg-destructive"
    : "bg-muted-foreground/40";
}
function healthLabel(h: RuntimeHealth) {
  return h === "ok" ? "Healthy" : h === "degraded" ? "Degraded" : h === "down" ? "Down" : "Unknown";
}

function buildServiceStatuses(rows: Array<{ service?: string; status?: string; message?: string | null } & Record<string, unknown>> | undefined): ServiceStatus[] {
  const known: Array<ServiceStatus["service"]> = ["azuracast", "liquidsoap", "icecast", "stereo_tool"];
  return known.map((svc) => {
    const row = rows?.find((r) => (r.service ?? "").toLowerCase() === svc);
    if (!row) {
      return {
        service: svc,
        health: svc === "azuracast" ? "unknown" : "unknown",
        detail: svc === "azuracast" ? "No probe yet" : "Awaiting runner telemetry",
      };
    }
    const status = String(row.status ?? "unknown").toLowerCase();
    const health: RuntimeHealth =
      status === "ok" || status === "healthy" ? "ok"
      : status === "degraded" || status === "warning" ? "degraded"
      : status === "down" || status === "error" || status === "failed" ? "down"
      : "unknown";
    return { service: svc, health, detail: (row.message as string | null) ?? "—" };
  });
}

function mapSyncJobStatus(s: string | null | undefined): SyncStatus {
  switch ((s ?? "").toLowerCase()) {
    case "completed": return "synced";
    case "failed":    return "failed";
    case "running":   return "pushing";
    case "pending":   return "pending";
    default:          return "pending";
  }
}

function formatTime(s: number) {
  const m = Math.floor(s / 60);
  const r = Math.floor(s % 60);
  return `${m}:${r.toString().padStart(2, "0")}`;
}

// ---- Mock data (TODO: replace with server-fn bindings) -------------------

const MOCK_QUEUE: QueueItem[] = [
  { id: "q1", position: 1, title: "Awaiting runtime", artist: "—",        source: "rotation" },
  { id: "q2", position: 2, title: "Awaiting runtime", artist: "—",        source: "rotation" },
  { id: "q3", position: 3, title: "Awaiting runtime", artist: "—",        source: "jingle"   },
  { id: "q4", position: 4, title: "Awaiting runtime", artist: "—",        source: "ad"       },
  { id: "q5", position: 5, title: "Awaiting runtime", artist: "—",        source: "rotation" },
];

const MOCK_LISTENERS = 0;

const MOCK_ERRORS: RuntimeError[] = [];
