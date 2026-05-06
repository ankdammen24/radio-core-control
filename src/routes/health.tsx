import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { AppLayout } from "@/components/app-layout";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

export const Route = createFileRoute("/health")({ component: HealthPage });

const statusVariant = (s: string) =>
  s === "ok" || s === "healthy" ? "default" : s === "degraded" ? "secondary" : "destructive";

function HealthPage() {
  const { data } = useQuery({
    queryKey: ["service-health"],
    refetchInterval: 10_000,
    queryFn: async () => {
      const { data } = await supabase.from("service_health").select("*, stations(name)").order("reported_at", { ascending: false }).limit(100);
      return data ?? [];
    },
  });

  // Latest per service
  const latest: Record<string, any> = {};
  (data ?? []).forEach((r: any) => { if (!latest[r.service]) latest[r.service] = r; });

  return (
    <AppLayout title="Service Health" description="Heartbeats from icecast-kh, liquidsoap, worker">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
        {["icecast", "liquidsoap", "worker"].map((svc) => {
          const r = latest[svc];
          return (
            <Card key={svc} className="p-4">
              <div className="flex items-center justify-between">
                <div className="text-xs uppercase tracking-wider text-muted-foreground">{svc}</div>
                <Badge variant={r ? (statusVariant(r.status) as any) : "outline"}>{r?.status ?? "no data"}</Badge>
              </div>
              <div className="mt-2 text-sm">{r?.message ?? "—"}</div>
              <div className="text-xs text-muted-foreground mt-1">{r ? new Date(r.reported_at).toLocaleString() : "Awaiting first heartbeat"}</div>
            </Card>
          );
        })}
      </div>
      <Card className="p-4">
        <h2 className="text-sm font-semibold mb-3">Recent heartbeats</h2>
        <div className="text-sm divide-y divide-border max-h-[50vh] overflow-y-auto">
          {(data ?? []).map((r: any) => (
            <div key={r.id} className="py-2 flex justify-between">
              <span>{r.service} · {r.stations?.name ?? "global"}</span>
              <span className="text-muted-foreground"><Badge variant={statusVariant(r.status) as any} className="mr-2">{r.status}</Badge>{new Date(r.reported_at).toLocaleTimeString()}</span>
            </div>
          ))}
          {(data ?? []).length === 0 && <div className="text-sm text-muted-foreground py-4">No heartbeats yet.</div>}
        </div>
      </Card>
    </AppLayout>
  );
}
