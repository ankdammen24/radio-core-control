import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { AppLayout } from "@/components/app-layout";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/data-states";

export const Route = createFileRoute("/listeners")({ component: ListenersPage });

function ListenersPage() {
  const { data } = useQuery({
    queryKey: ["listener-stats"],
    refetchInterval: 10_000,
    queryFn: async () => {
      const { data } = await supabase.from("listener_stats").select("*, stations(name,slug)").order("recorded_at", { ascending: false }).limit(200);
      return data ?? [];
    },
  });

  const grouped: Record<string, { name: string; current: number; peak: number }> = {};
  (data ?? []).forEach((r: any) => {
    const key = r.stations?.slug ?? r.station_id;
    if (!grouped[key]) grouped[key] = { name: r.stations?.name ?? key, current: r.listeners, peak: r.peak_listeners };
    if (r.peak_listeners > grouped[key].peak) grouped[key].peak = r.peak_listeners;
  });

  return (
    <AppLayout title="Listener Stats" description="Aggregated samples reported by Icecast-KH">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
        {Object.entries(grouped).map(([k, v]) => (
          <Card key={k} className="p-4">
            <div className="text-xs uppercase tracking-wider text-muted-foreground">{v.name}</div>
            <div className="text-3xl font-semibold mt-1">{v.current}</div>
            <div className="text-xs text-muted-foreground">peak {v.peak}</div>
          </Card>
        ))}
        {Object.keys(grouped).length === 0 && <Card className="p-6 col-span-full"><EmptyState title="No listener samples" description="The Icecast worker hasn't reported any data yet." /></Card>}
      </div>
      <Card className="p-4">
        <h2 className="text-sm font-semibold mb-3">Recent samples</h2>
        <div className="text-sm divide-y divide-border max-h-[50vh] overflow-y-auto">
          {(data ?? []).map((r: any) => (
            <div key={r.id} className="py-2 flex justify-between">
              <span>{r.stations?.name ?? r.station_id} · {r.mount_path ?? "—"}</span>
              <span className="text-muted-foreground">{r.listeners} (peak {r.peak_listeners}) · {new Date(r.recorded_at).toLocaleTimeString()}</span>
            </div>
          ))}
        </div>
      </Card>
    </AppLayout>
  );
}
