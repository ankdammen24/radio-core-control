import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { AppLayout } from "@/components/app-layout";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select";
import { EmptyState } from "@/components/data-states";
import { useAuth } from "@/lib/auth";
import { ShieldAlert, Plus, Trash2, ArrowUp, ArrowDown, Save } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/fallback")({ component: FallbackPage });

function FallbackPage() {
  const qc = useQueryClient();
  const { roles } = useAuth();
  const canEdit = roles.includes("admin") || roles.includes("editor");
  const isAdmin = roles.includes("admin");
  const [stationId, setStationId] = useState<string>("");

  const stations = useQuery({
    queryKey: ["fallback-stations"],
    queryFn: async () => (await supabase.from("stations").select("id,name,slug").eq("is_active", true).order("name")).data ?? [],
  });
  if (!stationId && stations.data?.length) setStationId(stations.data[0].id);

  const tracks = useQuery({
    queryKey: ["fallback-tracks", stationId], enabled: !!stationId,
    queryFn: async () => (await supabase
      .from("fallback_tracks")
      .select("*, media_files(file_name,file_path)")
      .eq("station_id", stationId)
      .order("priority")).data ?? [],
  });

  const media = useQuery({
    queryKey: ["fallback-media", stationId], enabled: !!stationId,
    queryFn: async () => (await supabase
      .from("media_files").select("id,file_name,file_path,media_kind")
      .eq("station_id", stationId).order("file_name").limit(500)).data ?? [],
  });

  const liqCfg = useQuery({
    queryKey: ["fallback-liq", stationId], enabled: !!stationId,
    queryFn: async () => (await supabase.from("liquidsoap_configs").select("fallback_track_path").eq("station_id", stationId).maybeSingle()).data,
  });

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ["fallback-tracks", stationId] });
    qc.invalidateQueries({ queryKey: ["fallback-liq", stationId] });
  };

  const reprioritize = useMutation({
    mutationFn: async ({ id, priority }: { id: string; priority: number }) => {
      const { error } = await supabase.from("fallback_tracks").update({ priority }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: invalidate,
  });

  const toggleActive = useMutation({
    mutationFn: async ({ id, is_active }: { id: string; is_active: boolean }) => {
      const { error } = await supabase.from("fallback_tracks").update({ is_active }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: invalidate,
  });

  const remove = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("fallback_tracks").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => { toast.success("Borttaget"); invalidate(); },
  });

  const saveLastResort = useMutation({
    mutationFn: async (path: string) => {
      const { error } = await supabase.from("liquidsoap_configs").update({ fallback_track_path: path || null }).eq("station_id", stationId);
      if (error) throw error;
    },
    onSuccess: () => { toast.success("Last-resort sparat"); invalidate(); },
    onError: (e: any) => toast.error(e.message),
  });

  const list = tracks.data ?? [];

  return (
    <AppLayout
      title="Fallback Audio"
      description="Säkerhetskälla per station — spelas när schemalagd playout eller live källa går ner"
    >
      <div className="mb-4 flex items-center gap-3">
        <Label className="text-xs uppercase tracking-wider text-muted-foreground">Station</Label>
        <Select value={stationId} onValueChange={setStationId}>
          <SelectTrigger className="w-72"><SelectValue placeholder="Välj station…" /></SelectTrigger>
          <SelectContent>
            {(stations.data ?? []).map((s: any) => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      {!stationId ? (
        <EmptyState title="Välj en station" />
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          <Card className="p-5 lg:col-span-2">
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-sm font-semibold flex items-center gap-2"><ShieldAlert className="w-4 h-4" /> Fallback-kedja</h2>
            </div>
            <p className="text-xs text-muted-foreground mb-3">
              Spelas i prioritetsordning när Liquidsoap inte har någon annan källa redo. Kedjan emitteras som <code className="font-mono">fallback.m3u</code> och refereras från <code className="font-mono">radio.liq</code>.
            </p>
            <div className="divide-y divide-border">
              {list.length === 0 && <EmptyState title="Inga fallback-tracks" description="Lägg till minst en låt så stationen aldrig blir tyst." />}
              {list.map((t: any, idx: number) => (
                <div key={t.id} className="py-3 flex items-center gap-3">
                  <div className="text-xs font-mono w-8 text-muted-foreground">{t.priority}</div>
                  <div className="flex-1 min-w-0">
                    <div className="font-medium truncate">{t.label}</div>
                    <div className="text-xs text-muted-foreground truncate">
                      {t.external_url ?? t.media_files?.file_path ?? t.media_files?.file_name ?? "—"}
                    </div>
                  </div>
                  {!t.is_active && <Badge variant="outline">inaktiv</Badge>}
                  <div className="flex items-center gap-1">
                    <Button size="icon" variant="ghost" disabled={!canEdit || idx === 0}
                      onClick={() => reprioritize.mutate({ id: t.id, priority: Math.max(0, t.priority - 1) })}>
                      <ArrowUp className="w-4 h-4" />
                    </Button>
                    <Button size="icon" variant="ghost" disabled={!canEdit || idx === list.length - 1}
                      onClick={() => reprioritize.mutate({ id: t.id, priority: t.priority + 1 })}>
                      <ArrowDown className="w-4 h-4" />
                    </Button>
                    <Switch checked={t.is_active} disabled={!canEdit}
                      onCheckedChange={(v) => toggleActive.mutate({ id: t.id, is_active: v })} />
                    <Button size="icon" variant="ghost" disabled={!isAdmin} onClick={() => remove.mutate(t.id)}>
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </Card>

          <div className="space-y-4">
            <AddTrackCard stationId={stationId} canEdit={canEdit} media={media.data ?? []} onAdded={invalidate} nextPriority={(list[list.length - 1]?.priority ?? 0) + 10} />
            <Card className="p-5">
              <h3 className="text-sm font-semibold mb-2">Sista utvägen (single)</h3>
              <p className="text-xs text-muted-foreground mb-3">
                Absolut filväg som körs som <code className="font-mono">single()</code> om hela fallback-kedjan misslyckas. Lämna tomt för att bara använda <code className="font-mono">blank()</code>.
              </p>
              <LastResortEditor
                value={liqCfg.data?.fallback_track_path ?? ""}
                disabled={!isAdmin}
                onSave={(v) => saveLastResort.mutate(v)}
              />
            </Card>
          </div>
        </div>
      )}
    </AppLayout>
  );
}

function AddTrackCard({ stationId, canEdit, media, onAdded, nextPriority }: {
  stationId: string; canEdit: boolean;
  media: { id: string; file_name: string; file_path: string | null }[];
  onAdded: () => void; nextPriority: number;
}) {
  const [mode, setMode] = useState<"file" | "url">("file");
  const [label, setLabel] = useState("");
  const [mediaId, setMediaId] = useState("");
  const [url, setUrl] = useState("");
  const [priority, setPriority] = useState(nextPriority);

  const submit = async () => {
    if (!label) { toast.error("Label krävs"); return; }
    const payload: any = { station_id: stationId, label, priority };
    if (mode === "file") {
      if (!mediaId) { toast.error("Välj fil"); return; }
      payload.media_file_id = mediaId;
    } else {
      if (!url) { toast.error("URL krävs"); return; }
      payload.external_url = url;
    }
    const { error } = await supabase.from("fallback_tracks").insert(payload);
    if (error) { toast.error(error.message); return; }
    toast.success("Tillagd");
    setLabel(""); setMediaId(""); setUrl(""); setPriority(priority + 10);
    onAdded();
  };

  return (
    <Card className="p-5 space-y-3">
      <h3 className="text-sm font-semibold">Lägg till fallback</h3>
      <div className="flex gap-2">
        <Button size="sm" variant={mode === "file" ? "default" : "outline"} onClick={() => setMode("file")}>Mediafil</Button>
        <Button size="sm" variant={mode === "url" ? "default" : "outline"} onClick={() => setMode("url")}>Extern URL</Button>
      </div>
      <Input placeholder="Etikett (t.ex. Evergreen-mix)" value={label} onChange={(e) => setLabel(e.target.value)} />
      {mode === "file" ? (
        <Select value={mediaId} onValueChange={setMediaId}>
          <SelectTrigger><SelectValue placeholder="Välj mediafil…" /></SelectTrigger>
          <SelectContent>
            {media.map((m) => <SelectItem key={m.id} value={m.id}>{m.file_name}</SelectItem>)}
          </SelectContent>
        </Select>
      ) : (
        <Input placeholder="https://… eller /data/stations/…" value={url} onChange={(e) => setUrl(e.target.value)} />
      )}
      <div className="flex items-center gap-2">
        <Label className="text-xs">Prio</Label>
        <Input type="number" className="w-24" value={priority} onChange={(e) => setPriority(Number(e.target.value))} />
        <Button className="ml-auto" disabled={!canEdit} onClick={submit}>
          <Plus className="w-4 h-4 mr-1" /> Lägg till
        </Button>
      </div>
    </Card>
  );
}

function LastResortEditor({ value, disabled, onSave }: { value: string; disabled: boolean; onSave: (v: string) => void }) {
  const [v, setV] = useState(value);
  // Sync when prop changes
  if (v === "" && value && v !== value) setV(value);
  return (
    <div className="space-y-2">
      <Input placeholder="/data/stations/<slug>/media/silence.mp3" value={v} onChange={(e) => setV(e.target.value)} disabled={disabled} />
      <Button size="sm" disabled={disabled} onClick={() => onSave(v)}>
        <Save className="w-4 h-4 mr-1" /> Spara
      </Button>
    </div>
  );
}
