import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { database } from "@/services/database";
import { AppLayout } from "@/components/app-layout";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/data-states";
import { azuracastGetListeners } from "@/lib/azuracast-runtime.functions";

export const Route = createFileRoute("/listeners")({ component: ListenersPage });

function ListenersPage() {
  const { data } = useQuery({
    queryKey: ["listener-stats"],
    refetchInterval: 10_000,
    queryFn: async () => {
      const { data } = await database.from("listener_stats").select("*, stations(name,slug)").order("recorded_at", { ascending: false }).limit(200);
      return data ?? [];
    },
  });

  const { data: stations } = useQuery({
    queryKey: ["stations-with-az-listeners"],
    queryFn: async () => {
      const { data } = await database
        .from("stations")
        .select("id,name,slug, azuracast_connections(id)")
        .order("name");
      return (data ?? []).filter((s: any) => s.azuracast_connections?.length);
    },
  });

  const grouped: Record<string, { name: string; current: number; peak: number }> = {};
  (data ?? []).forEach((r: any) => {
    const key = r.stations?.slug ?? r.station_id;
    if (!grouped[key]) grouped[key] = { name: r.stations?.name ?? key, current: r.listeners, peak: r.peak_listeners };
    if (r.peak_listeners > grouped[key].peak) grouped[key].peak = r.peak_listeners;
  });

  return (
    <AppLayout title="Listener Stats" description="Live listeners from AzuraCast + samples reported by Icecast-KH">
      {(stations?.length ?? 0) > 0 && (
        <div className="mb-4 grid grid-cols-1 md:grid-cols-2 gap-3">
          {stations!.map((s: any) => (
            <LiveListenersCard key={s.id} stationId={s.id} stationName={s.name} />
          ))}
        </div>
      )}

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

function LiveListenersCard({ stationId, stationName }: { stationId: string; stationName: string }) {
  const getListeners = useServerFn(azuracastGetListeners);
  const { data, error, isLoading } = useQuery({
    queryKey: ["az-listeners", stationId],
    queryFn: () => getListeners({ data: { station_id: stationId } }),
    refetchInterval: 15_000,
  });

  const listeners = (data?.listeners ?? []) as any[];
  const byMount: Record<string, number> = {};
  listeners.forEach((l) => {
    const m = l.mount?.name ?? l.mount?.url ?? l.mount_name ?? "—";
    byMount[m] = (byMount[m] ?? 0) + 1;
  });

  return (
    <Card className="p-4">
      <div className="flex items-center justify-between mb-2">
        <div className="text-xs uppercase tracking-wider text-muted-foreground">{stationName} · Live</div>
        <Badge variant={error ? "destructive" : "default"}>
          {isLoading ? "…" : error ? "error" : `${listeners.length} live`}
        </Badge>
      </div>
      {error ? <div className="text-xs text-destructive">{(error as Error).message}</div> :
        <div className="text-xs space-y-1">
          {Object.entries(byMount).length === 0 && !isLoading && <div className="text-muted-foreground">No live listeners</div>}
          {Object.entries(byMount).map(([m, n]) => (
            <div key={m} className="flex justify-between"><span className="truncate">{m}</span><span className="font-medium">{n}</span></div>
          ))}
        </div>
      }
    </Card>
  );
}
