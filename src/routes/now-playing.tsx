import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { AppLayout } from "@/components/app-layout";
import { Card } from "@/components/ui/card";
import { Activity } from "lucide-react";
import { EmptyState } from "@/components/data-states";

export const Route = createFileRoute("/now-playing")({ component: NowPlayingPage });

function NowPlayingPage() {
  const { data, isLoading } = useQuery({
    queryKey: ["now-playing-all"],
    refetchInterval: 5_000,
    queryFn: async () => {
      const { data } = await supabase.from("now_playing").select("*, stations(name,slug)").order("updated_at", { ascending: false });
      return data ?? [];
    },
  });
  const { data: history } = useQuery({
    queryKey: ["play-history"],
    refetchInterval: 15_000,
    queryFn: async () => {
      const { data } = await supabase.from("play_history").select("*, stations(name,slug)").order("played_at", { ascending: false }).limit(50);
      return data ?? [];
    },
  });

  return (
    <AppLayout title="Now Playing" description="Live track + recent history per station">
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card className="p-4">
          <h2 className="text-sm font-semibold mb-3 flex items-center gap-2"><Activity className="w-4 h-4" /> Live</h2>
          {isLoading ? <div className="text-sm text-muted-foreground">Loading…</div>
            : (data?.length ?? 0) === 0 ? <EmptyState title="No live data" description="Liquidsoap hasn't reported any tracks yet." />
            : <ul className="space-y-3">
                {data!.map((np: any) => (
                  <li key={np.station_id} className="border border-border rounded-md p-3">
                    <div className="text-xs uppercase tracking-wider text-muted-foreground">{np.stations?.name ?? np.station_id}</div>
                    <div className="font-medium">{np.title ?? "—"}</div>
                    <div className="text-sm text-muted-foreground">{np.artist ?? ""} {np.album ? `· ${np.album}` : ""}</div>
                    <div className="text-xs text-muted-foreground mt-1">{np.listeners ?? 0} listeners · mount {np.mount_path ?? "—"}</div>
                  </li>
                ))}
              </ul>}
        </Card>
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
