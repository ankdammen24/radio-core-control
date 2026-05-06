import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { AppLayout } from "@/components/app-layout";
import { Card } from "@/components/ui/card";
import { StatusBadge } from "@/components/status-badge";
import { Radio, Music, AlertTriangle, ListMusic, RefreshCw, Activity, ScrollText } from "lucide-react";

export const Route = createFileRoute("/")({ component: Dashboard });

function StatCard({ icon: Icon, label, value, hint, tone }: { icon: any; label: string; value: number | string; hint?: string; tone?: "default" | "warn" | "error" | "success" }) {
  const toneCls = tone === "warn" ? "text-warning" : tone === "error" ? "text-destructive" : tone === "success" ? "text-success" : "text-foreground";
  return (
    <Card className="p-5">
      <div className="flex items-start justify-between">
        <div>
          <div className="text-xs uppercase tracking-wider text-muted-foreground">{label}</div>
          <div className={`mt-2 text-3xl font-semibold tabular-nums ${toneCls}`}>{value}</div>
          {hint && <div className="text-xs text-muted-foreground mt-1">{hint}</div>}
        </div>
        <div className="w-9 h-9 rounded bg-muted flex items-center justify-center"><Icon className="w-4 h-4 text-muted-foreground" /></div>
      </div>
    </Card>
  );
}

function Dashboard() {
  const { data, isLoading } = useQuery({
    queryKey: ["dashboard"],
    queryFn: async () => {
      const [stations, media, missing, playlists, failed, audit] = await Promise.all([
        supabase.from("stations").select("*", { count: "exact", head: true }).eq("is_active", true),
        supabase.from("media_files").select("*", { count: "exact", head: true }),
        supabase.from("media_files").select("*", { count: "exact", head: true }).eq("status", "missing_metadata"),
        supabase.from("playlists").select("*", { count: "exact", head: true }).eq("is_active", true),
        supabase.from("sync_jobs").select("*", { count: "exact", head: true }).eq("status", "failed"),
        supabase.from("audit_logs").select("*").order("created_at", { ascending: false }).limit(8),
      ]);
      return {
        stations: stations.count ?? 0,
        media: media.count ?? 0,
        missing: missing.count ?? 0,
        playlists: playlists.count ?? 0,
        failed: failed.count ?? 0,
        audit: audit.data ?? [],
      };
    },
  });

  return (
    <AppLayout title="Dashboard" description="Operational overview of Radio Uppsala broadcast systems.">
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-4">
        <StatCard icon={Radio} label="Active Stations" value={isLoading ? "—" : data!.stations} />
        <StatCard icon={Music} label="Media Files" value={isLoading ? "—" : data!.media} />
        <StatCard icon={AlertTriangle} label="Missing Metadata" value={isLoading ? "—" : data!.missing} tone={data?.missing ? "warn" : "default"} />
        <StatCard icon={ListMusic} label="Active Playlists" value={isLoading ? "—" : data!.playlists} />
        <StatCard icon={RefreshCw} label="Failed Sync Jobs" value={isLoading ? "—" : data!.failed} tone={data?.failed ? "error" : "success"} />
      </div>

      <div className="mt-6 grid grid-cols-1 lg:grid-cols-3 gap-4">
        <Card className="p-5 lg:col-span-2">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="font-semibold">Now Playing</h3>
              <p className="text-xs text-muted-foreground">Live data from AzuraCast</p>
            </div>
            <Activity className="w-4 h-4 text-muted-foreground" />
          </div>
          <div className="rounded border border-dashed border-border p-6 text-center text-sm text-muted-foreground">
            No AzuraCast connection configured.<br />
            <span className="text-xs">Add a connection in <span className="font-medium text-foreground">AzuraCast Integration</span> to see live now-playing data.</span>
          </div>
        </Card>

        <Card className="p-5">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold">Recent Activity</h3>
            <ScrollText className="w-4 h-4 text-muted-foreground" />
          </div>
          {data?.audit?.length ? (
            <ul className="space-y-3 text-sm">
              {data.audit.map((a) => (
                <li key={a.id} className="flex items-start justify-between gap-2 border-b border-border pb-2 last:border-0">
                  <div>
                    <div className="font-medium">{a.action}</div>
                    <div className="text-xs text-muted-foreground">{a.entity_type ?? "—"}</div>
                  </div>
                  <div className="text-[10px] text-muted-foreground whitespace-nowrap">{new Date(a.created_at).toLocaleString()}</div>
                </li>
              ))}
            </ul>
          ) : (
            <div className="text-sm text-muted-foreground">No recent activity.</div>
          )}
        </Card>
      </div>

      <div className="mt-6 grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="p-5"><div className="text-xs uppercase tracking-wider text-muted-foreground">System</div><div className="mt-2 flex items-center gap-2"><StatusBadge status="ok" /><span className="text-sm">Database online</span></div></Card>
        <Card className="p-5"><div className="text-xs uppercase tracking-wider text-muted-foreground">AzuraCast</div><div className="mt-2 flex items-center gap-2"><StatusBadge status="untested" /><span className="text-sm">Not configured</span></div></Card>
        <Card className="p-5"><div className="text-xs uppercase tracking-wider text-muted-foreground">Storage</div><div className="mt-2 flex items-center gap-2"><StatusBadge status="ready" /><span className="text-sm">Local path ready</span></div></Card>
      </div>
    </AppLayout>
  );
}
