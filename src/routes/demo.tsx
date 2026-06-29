import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { database } from "@/services/database";
import { AppLayout } from "@/components/app-layout";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/data-states";
import { Play, Pause, Volume2, Radio, SkipForward, Sparkles, RefreshCw } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { useAuth } from "@/lib/auth";

export const Route = createFileRoute("/demo")({ component: DemoPage });

function DemoPage() {
  const qc = useQueryClient();
  const { isEditor } = useAuth();
  const [stationId, setStationId] = useState<string>("");
  const [playing, setPlaying] = useState(false);
  const [volume, setVolume] = useState(0.8);
  const [simEnabled, setSimEnabled] = useState(true);
  const [intervalSec, setIntervalSec] = useState(30);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  const stations = useQuery({
    queryKey: ["stations-demo"],
    queryFn: async () => (await database.from("stations").select("id,name,slug,demo_mode,demo_stream_url,demo_artwork_url").order("name")).data ?? [],
  });

  useEffect(() => {
    if (!stationId && stations.data?.length) {
      const first = stations.data.find((s: any) => s.demo_mode) ?? stations.data[0];
      setStationId(first.id);
    }
  }, [stations.data, stationId]);

  const station = useMemo(() => stations.data?.find((s: any) => s.id === stationId), [stations.data, stationId]);

  const updateDemo = useMutation({
    mutationFn: async (patch: Partial<{ demo_mode: boolean; demo_stream_url: string | null; demo_artwork_url: string | null }>) => {
      const { error } = await database.from("stations").update(patch).eq("id", stationId);
      if (error) throw error;
    },
    onSuccess: () => { toast.success("Saved"); qc.invalidateQueries({ queryKey: ["stations-demo"] }); },
    onError: (e: any) => toast.error(e.message),
  });

  // Audio control
  useEffect(() => {
    const a = audioRef.current; if (!a) return;
    a.volume = volume;
  }, [volume]);
  useEffect(() => {
    const a = audioRef.current; if (!a) return;
    if (playing) a.play().catch((e) => { setPlaying(false); toast.error(`Cannot play: ${e.message}`); });
    else a.pause();
  }, [playing, station?.demo_stream_url]);

  // Now playing
  const np = useQuery({
    queryKey: ["np", stationId], enabled: !!stationId, refetchInterval: 5000,
    queryFn: async () => (await database.from("now_playing").select("*").eq("station_id", stationId).maybeSingle()).data,
  });

  // Library for the simulator
  const media = useQuery({
    queryKey: ["media-for-demo", stationId], enabled: !!stationId,
    queryFn: async () => (await database.from("media_files")
      .select("id,file_name,original_file_name,duration_seconds,station_id")
      .or(`station_id.eq.${stationId},station_id.is.null`).limit(500)).data ?? [],
  });

  const tickSimulator = async () => {
    if (!stationId) return;
    const lib = media.data ?? [];
    if (!lib.length) { toast.error("No media files in library — upload some first."); return; }
    const pick: any = lib[Math.floor(Math.random() * lib.length)];
    const name = pick.original_file_name ?? pick.file_name ?? "Track";
    const m = name.replace(/\.[^.]+$/, "").match(/^(.*?)\s*[-–]\s*(.*)$/);
    const artist = m?.[1] ?? "Demo Artist";
    const title = m?.[2] ?? name;
    const listeners = Math.floor(40 + Math.random() * 80);
    const dur = pick.duration_seconds ?? 180;

    await database.from("now_playing").upsert({
      station_id: stationId, media_file_id: pick.id, title, artist,
      album: "Demo Mode", listeners, duration_seconds: dur,
      mount_path: "/demo.mp3", started_at: new Date().toISOString(), updated_at: new Date().toISOString(),
    }, { onConflict: "station_id" });
    await database.from("play_history").insert({
      station_id: stationId, media_file_id: pick.id, title, artist, album: "Demo Mode",
      listeners, duration_seconds: dur,
    });
    await database.from("listener_stats").insert({
      station_id: stationId, mount_path: "/demo.mp3", listeners, peak_listeners: listeners + 5,
    });
    qc.invalidateQueries({ queryKey: ["np", stationId] });
  };

  // Auto-tick
  useEffect(() => {
    if (!simEnabled || !stationId || !isEditor) return;
    const id = setInterval(tickSimulator, Math.max(5, intervalSec) * 1000);
    return () => clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [simEnabled, stationId, intervalSec, media.data, isEditor]);

  return (
    <AppLayout
      title="Demo Mode"
      description="Browser-based demo player + now-playing simulator. Use this when no Liquidsoap/Icecast backend is connected."
    >
      {(stations.data?.length ?? 0) === 0 ? (
        <EmptyState icon={Radio} title="No stations" description="Create a station first." />
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          <Card className="p-5 lg:col-span-2 space-y-4">
            <div className="flex items-center gap-3">
              <Select value={stationId} onValueChange={setStationId}>
                <SelectTrigger className="w-72"><SelectValue placeholder="Select station" /></SelectTrigger>
                <SelectContent>
                  {stations.data?.map((s: any) => (
                    <SelectItem key={s.id} value={s.id}>{s.name} {s.demo_mode && "· demo"}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {station?.demo_mode && <Badge variant="secondary"><Sparkles className="w-3 h-3 mr-1" />Demo on</Badge>}
            </div>

            {station && (
              <div className="grid grid-cols-1 md:grid-cols-[160px_1fr] gap-5 items-center pt-2">
                <div className="aspect-square rounded-md bg-muted overflow-hidden flex items-center justify-center">
                  {station.demo_artwork_url
                    ? <img src={station.demo_artwork_url} alt="" className="w-full h-full object-cover" />
                    : <Radio className="w-10 h-10 text-muted-foreground" />}
                </div>
                <div className="space-y-1">
                  <div className="text-xs uppercase tracking-wider text-muted-foreground">Now playing</div>
                  <div className="text-2xl font-semibold leading-tight">{np.data?.title ?? "—"}</div>
                  <div className="text-muted-foreground">{np.data?.artist ?? "Waiting for simulator…"}</div>
                  <div className="text-xs text-muted-foreground pt-1">
                    {np.data?.listeners ?? 0} listeners · mount {np.data?.mount_path ?? "—"}
                  </div>

                  <div className="flex items-center gap-2 pt-3">
                    <Button onClick={() => setPlaying((p) => !p)} disabled={!station.demo_stream_url} size="sm">
                      {playing ? <Pause className="w-4 h-4 mr-1" /> : <Play className="w-4 h-4 mr-1" />}
                      {playing ? "Pause" : "Play stream"}
                    </Button>
                    <Button variant="outline" size="sm" onClick={tickSimulator} disabled={!isEditor}>
                      <SkipForward className="w-4 h-4 mr-1" />Next track
                    </Button>
                    <div className="flex items-center gap-2 ml-3">
                      <Volume2 className="w-4 h-4 text-muted-foreground" />
                      <input type="range" min={0} max={1} step={0.01} value={volume}
                        onChange={(e) => setVolume(parseFloat(e.target.value))} className="w-32" />
                    </div>
                  </div>
                  {!station.demo_stream_url && (
                    <p className="text-xs text-muted-foreground pt-2">
                      Add a public stream URL on the right to enable in-browser playback.
                    </p>
                  )}
                </div>
              </div>
            )}

            <audio
              ref={audioRef}
              src={station?.demo_stream_url ?? undefined}
              crossOrigin="anonymous"
              preload="none"
              onError={() => { setPlaying(false); toast.error("Stream error — check the URL (must be HTTPS + CORS-friendly)."); }}
            />
          </Card>

          <Card className="p-5 space-y-4">
            <div>
              <h3 className="font-semibold text-sm flex items-center gap-2"><Sparkles className="w-4 h-4" /> Demo settings</h3>
              <p className="text-xs text-muted-foreground">Per-station configuration for the demo.</p>
            </div>

            {station && (
              <>
                <div className="flex items-center justify-between">
                  <Label>Demo mode</Label>
                  <Switch checked={!!station.demo_mode} disabled={!isEditor}
                    onCheckedChange={(v) => updateDemo.mutate({ demo_mode: v })} />
                </div>
                <div>
                  <Label>Public stream URL</Label>
                  <Input
                    placeholder="https://stream.example.com/radio.mp3"
                    defaultValue={station.demo_stream_url ?? ""} disabled={!isEditor}
                    onBlur={(e) => {
                      const v = e.target.value.trim();
                      if (v !== (station.demo_stream_url ?? "")) updateDemo.mutate({ demo_stream_url: v || null });
                    }}
                  />
                  <p className="text-[11px] text-muted-foreground mt-1">Browser must be able to load it (HTTPS + CORS).</p>
                </div>
                <div>
                  <Label>Artwork URL</Label>
                  <Input
                    placeholder="https://…/cover.jpg"
                    defaultValue={station.demo_artwork_url ?? ""} disabled={!isEditor}
                    onBlur={(e) => {
                      const v = e.target.value.trim();
                      if (v !== (station.demo_artwork_url ?? "")) updateDemo.mutate({ demo_artwork_url: v || null });
                    }}
                  />
                </div>

                <div className="border-t pt-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <Label>Now-playing simulator</Label>
                      <p className="text-[11px] text-muted-foreground">Picks tracks from the media library and writes to now_playing + history.</p>
                    </div>
                    <Switch checked={simEnabled} onCheckedChange={setSimEnabled} disabled={!isEditor} />
                  </div>
                  <div className="flex items-center gap-2">
                    <Label className="w-32 shrink-0">Tick every</Label>
                    <Input type="number" min={5} value={intervalSec}
                      onChange={(e) => setIntervalSec(parseInt(e.target.value || "30", 10))}
                      className="w-24" />
                    <span className="text-xs text-muted-foreground">seconds</span>
                  </div>
                  <Button variant="outline" size="sm" onClick={tickSimulator} disabled={!isEditor} className="w-full">
                    <RefreshCw className="w-4 h-4 mr-1" />Tick now
                  </Button>
                  <p className="text-[11px] text-muted-foreground">
                    {(media.data?.length ?? 0)} tracks in library available to the simulator.
                  </p>
                </div>
              </>
            )}
          </Card>
        </div>
      )}
    </AppLayout>
  );
}
