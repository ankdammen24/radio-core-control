import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { AppLayout } from "@/components/app-layout";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { EmptyState } from "@/components/data-states";
import { ConfirmDialog } from "@/components/confirm-dialog";
import { useAuth } from "@/lib/auth";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Sliders, Plus, Trash2, Activity, ShieldAlert, FileCog } from "lucide-react";

export const Route = createFileRoute("/stereo-tool")({ component: StereoToolPage });

const STATUS_VARIANT: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
  running: "default", bypassed: "secondary", starting: "secondary",
  stopped: "outline", unknown: "outline", error: "destructive",
};

function StereoToolPage() {
  const qc = useQueryClient();
  const { isAdmin } = useAuth();
  const [stationId, setStationId] = useState<string>("");

  const stations = useQuery({
    queryKey: ["stations-min-st"],
    queryFn: async () => (await supabase.from("stations").select("id,name").order("name")).data ?? [],
  });

  useEffect(() => {
    if (!stationId && stations.data?.[0]) setStationId(stations.data[0].id);
  }, [stations.data, stationId]);

  const config = useQuery({
    queryKey: ["stereo-tool-config", stationId], enabled: !!stationId,
    queryFn: async () => {
      const { data } = await supabase.from("stereo_tool_configs").select("*").eq("station_id", stationId).maybeSingle();
      return data;
    },
  });

  const presets = useQuery({
    queryKey: ["stereo-tool-presets", stationId], enabled: !!stationId,
    queryFn: async () => (await supabase.from("stereo_tool_presets").select("*").eq("station_id", stationId).order("name")).data ?? [],
  });

  const events = useQuery({
    queryKey: ["stereo-tool-events", stationId], enabled: !!stationId,
    queryFn: async () => (await supabase.from("stereo_tool_events").select("*").eq("station_id", stationId).order("created_at", { ascending: false }).limit(50)).data ?? [],
  });

  const [form, setForm] = useState<any>(null);
  useEffect(() => { setForm(config.data ?? defaultConfig(stationId)); }, [config.data, stationId]);

  const save = useMutation({
    mutationFn: async () => {
      if (!form || !stationId) throw new Error("No station");
      const payload = { ...form, station_id: stationId };
      delete payload.created_at; delete payload.updated_at;
      const q = config.data?.id
        ? supabase.from("stereo_tool_configs").update(payload).eq("id", config.data.id)
        : supabase.from("stereo_tool_configs").insert(payload);
      const { error } = await q;
      if (error) throw error;
      await supabase.from("stereo_tool_events").insert({
        station_id: stationId, event_type: "config_saved", level: "info",
        message: `Config saved (${payload.integration_mode}, enabled=${payload.enabled}, bypass=${payload.bypass})`,
      });
    },
    onSuccess: () => {
      toast.success("Stereo Tool config saved");
      qc.invalidateQueries({ queryKey: ["stereo-tool-config", stationId] });
      qc.invalidateQueries({ queryKey: ["stereo-tool-events", stationId] });
    },
    onError: (e: any) => toast.error(e?.message ?? "Save failed"),
  });

  // preset form
  const [pName, setPName] = useState("");
  const [pDesc, setPDesc] = useState("");
  const [pPath, setPPath] = useState("");

  const addPreset = useMutation({
    mutationFn: async () => {
      if (!stationId) throw new Error("Station required");
      if (!pName.trim() || !pPath.trim()) throw new Error("Name and file path required");
      const { data: u } = await supabase.auth.getUser();
      const { error } = await supabase.from("stereo_tool_presets").insert({
        station_id: stationId, name: pName.trim(), description: pDesc.trim() || null,
        file_path: pPath.trim(), uploaded_by: u.user?.id ?? null,
      });
      if (error) throw error;
      await supabase.from("stereo_tool_events").insert({
        station_id: stationId, event_type: "preset_registered", level: "info",
        message: `Preset registered: ${pName.trim()} (${pPath.trim()})`,
      });
    },
    onSuccess: () => {
      toast.success("Preset registered");
      setPName(""); setPDesc(""); setPPath("");
      qc.invalidateQueries({ queryKey: ["stereo-tool-presets", stationId] });
      qc.invalidateQueries({ queryKey: ["stereo-tool-events", stationId] });
    },
    onError: (e: any) => toast.error(e?.message ?? "Failed"),
  });

  const delPreset = useMutation({
    mutationFn: async (row: any) => {
      const { error } = await supabase.from("stereo_tool_presets").delete().eq("id", row.id);
      if (error) throw error;
      await supabase.from("stereo_tool_events").insert({
        station_id: stationId, event_type: "preset_removed", level: "warn",
        message: `Preset removed: ${row.name}`,
      });
    },
    onSuccess: () => {
      toast.success("Preset removed");
      qc.invalidateQueries({ queryKey: ["stereo-tool-presets", stationId] });
      qc.invalidateQueries({ queryKey: ["stereo-tool-events", stationId] });
    },
    onError: (e: any) => toast.error(e?.message ?? "Failed"),
  });

  if (!stations.data?.length) {
    return (
      <AppLayout title="Stereo Tool" description="Optional Thimeo Stereo Tool audio processor per station.">
        <EmptyState icon={Sliders} title="No stations yet" description="Create a station first to configure Stereo Tool." />
      </AppLayout>
    );
  }

  return (
    <AppLayout title="Stereo Tool" description="Optional Thimeo Stereo Tool audio processor per station.">
      <div className="flex items-center gap-3 mb-4">
        <Label className="text-xs uppercase tracking-wider text-muted-foreground">Station</Label>
        <Select value={stationId} onValueChange={setStationId}>
          <SelectTrigger className="w-72"><SelectValue /></SelectTrigger>
          <SelectContent>
            {(stations.data ?? []).map((s: any) => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}
          </SelectContent>
        </Select>
        {form && (
          <Badge variant={STATUS_VARIANT[form.status] ?? "outline"} className="ml-auto uppercase">
            <Activity className="w-3 h-3 mr-1" /> {form.status}
          </Badge>
        )}
      </div>

      <Card className="p-4 mb-4 border-amber-500/40 bg-amber-500/5">
        <div className="flex gap-3 text-sm">
          <ShieldAlert className="w-5 h-5 text-amber-500 shrink-0" />
          <div className="text-muted-foreground">
            Thimeo Stereo Tool is proprietary, licensed software. Radio Core never ships its binary.
            Mount the licensed installation and license file into the streaming container under the configured Docker volume path,
            then point <span className="font-mono">binary_path</span> / <span className="font-mono">library_path</span> at it.
          </div>
        </div>
      </Card>

      {form && (
        <div className="grid lg:grid-cols-2 gap-6">
          <Card className="p-5 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="font-semibold flex items-center gap-2"><Sliders className="w-4 h-4" /> Processor</h3>
              <div className="flex items-center gap-3">
                <div className="flex items-center gap-2 text-sm">
                  <Label htmlFor="enabled">Enabled</Label>
                  <Switch id="enabled" checked={!!form.enabled} disabled={!isAdmin}
                    onCheckedChange={(v) => setForm({ ...form, enabled: v })} />
                </div>
                <div className="flex items-center gap-2 text-sm">
                  <Label htmlFor="bypass">Bypass</Label>
                  <Switch id="bypass" checked={!!form.bypass} disabled={!isAdmin}
                    onCheckedChange={(v) => setForm({ ...form, bypass: v })} />
                </div>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Integration mode</Label>
                <Select value={form.integration_mode} disabled={!isAdmin}
                  onValueChange={(v) => setForm({ ...form, integration_mode: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="liquidsoap_lib">Liquidsoap (libStereoTool)</SelectItem>
                    <SelectItem value="standalone">Standalone processor</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Active preset</Label>
                <Select value={form.active_preset_id ?? ""} disabled={!isAdmin}
                  onValueChange={(v) => setForm({ ...form, active_preset_id: v || null })}>
                  <SelectTrigger><SelectValue placeholder="None" /></SelectTrigger>
                  <SelectContent>
                    {(presets.data ?? []).map((p: any) => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Docker volume path</Label>
                <Input disabled={!isAdmin} value={form.docker_volume_path ?? ""}
                  onChange={(e) => setForm({ ...form, docker_volume_path: e.target.value })}
                  placeholder="/opt/stereotool" />
              </div>
              <div>
                <Label>License key secret</Label>
                <Input disabled={!isAdmin} value={form.license_key_secret_name ?? ""}
                  onChange={(e) => setForm({ ...form, license_key_secret_name: e.target.value })}
                  placeholder="STEREO_TOOL_LICENSE" />
              </div>
              <div>
                <Label>Binary path</Label>
                <Input disabled={!isAdmin} value={form.binary_path ?? ""}
                  onChange={(e) => setForm({ ...form, binary_path: e.target.value })}
                  placeholder="/opt/stereotool/stereo_tool_cmd" />
              </div>
              <div>
                <Label>Library path</Label>
                <Input disabled={!isAdmin} value={form.library_path ?? ""}
                  onChange={(e) => setForm({ ...form, library_path: e.target.value })}
                  placeholder="/opt/stereotool/libStereoTool.so" />
              </div>
              <div>
                <Label>Input source</Label>
                <Input disabled={!isAdmin} value={form.input_source ?? ""}
                  onChange={(e) => setForm({ ...form, input_source: e.target.value })}
                  placeholder="alsa://hw:Loopback,1 or pipe" />
              </div>
              <div>
                <Label>Output target</Label>
                <Input disabled={!isAdmin} value={form.output_target ?? ""}
                  onChange={(e) => setForm({ ...form, output_target: e.target.value })}
                  placeholder="icecast://source@icecast:8000/live.mp3" />
              </div>
              <div>
                <Label>Sample rate</Label>
                <Input type="number" disabled={!isAdmin} value={form.sample_rate}
                  onChange={(e) => setForm({ ...form, sample_rate: Number(e.target.value) || 48000 })} />
              </div>
              <div>
                <Label>Latency (ms)</Label>
                <Input type="number" disabled={!isAdmin} value={form.latency_ms}
                  onChange={(e) => setForm({ ...form, latency_ms: Number(e.target.value) || 0 })} />
              </div>
            </div>

            <div>
              <Label>Custom args</Label>
              <Textarea disabled={!isAdmin} rows={2} value={form.custom_args ?? ""}
                onChange={(e) => setForm({ ...form, custom_args: e.target.value })}
                placeholder="Extra CLI arguments passed to the processor" />
            </div>

            <Button onClick={() => save.mutate()} disabled={!isAdmin || save.isPending} className="w-full">
              {save.isPending ? "Saving…" : "Save configuration"}
            </Button>
          </Card>

          <div className="space-y-6">
            <Card className="p-5">
              <div className="flex items-center justify-between mb-3">
                <h3 className="font-semibold flex items-center gap-2"><FileCog className="w-4 h-4" /> Presets</h3>
                <Badge variant="outline">{presets.data?.length ?? 0}</Badge>
              </div>

              {isAdmin && (
                <div className="grid grid-cols-1 gap-2 mb-3">
                  <Input placeholder="Preset name" value={pName} onChange={(e) => setPName(e.target.value)} />
                  <Input placeholder="File path inside Docker volume (e.g. /opt/stereotool/presets/fm.sts)" value={pPath} onChange={(e) => setPPath(e.target.value)} />
                  <Input placeholder="Description (optional)" value={pDesc} onChange={(e) => setPDesc(e.target.value)} />
                  <Button size="sm" onClick={() => addPreset.mutate()} disabled={addPreset.isPending}>
                    <Plus className="w-3 h-3 mr-1" /> Register preset
                  </Button>
                </div>
              )}

              {(presets.data ?? []).length === 0 ? (
                <EmptyState icon={FileCog} title="No presets" description="Register a preset file path that exists in the mounted volume." />
              ) : (
                <div className="space-y-2">
                  {(presets.data ?? []).map((p: any) => (
                    <div key={p.id} className="rounded border p-2 flex items-center justify-between gap-2">
                      <div className="min-w-0">
                        <div className="font-medium text-sm truncate flex items-center gap-2">
                          {p.name}
                          {form.active_preset_id === p.id && <Badge variant="secondary" className="text-[10px]">ACTIVE</Badge>}
                        </div>
                        <div className="text-xs text-muted-foreground truncate font-mono">{p.file_path}</div>
                      </div>
                      {isAdmin && (
                        <ConfirmDialog
                          title="Remove preset?" description="This only removes the registry entry. The file in the Docker volume is untouched."
                          confirmText="Remove" destructive onConfirm={() => delPreset.mutateAsync(p)}
                          trigger={<Button size="sm" variant="outline"><Trash2 className="w-3 h-3" /></Button>}
                        />
                      )}
                    </div>
                  ))}
                </div>
              )}
            </Card>

            <Card className="p-5">
              <div className="flex items-center justify-between mb-3">
                <h3 className="font-semibold flex items-center gap-2"><Activity className="w-4 h-4" /> Event log</h3>
                <Badge variant="outline">{events.data?.length ?? 0}</Badge>
              </div>
              {(events.data ?? []).length === 0 ? (
                <EmptyState icon={Activity} title="No events" description="Processor events will appear here." />
              ) : (
                <div className="space-y-1.5 max-h-96 overflow-y-auto">
                  {(events.data ?? []).map((e: any) => (
                    <div key={e.id} className="text-xs border rounded px-2 py-1.5 flex items-start gap-2">
                      <Badge variant={e.level === "error" ? "destructive" : e.level === "warn" ? "secondary" : "outline"} className="uppercase text-[9px]">
                        {e.level}
                      </Badge>
                      <div className="min-w-0 flex-1">
                        <div className="font-medium truncate">{e.event_type}</div>
                        {e.message && <div className="text-muted-foreground truncate">{e.message}</div>}
                      </div>
                      <div className="text-muted-foreground shrink-0">{new Date(e.created_at).toLocaleTimeString()}</div>
                    </div>
                  ))}
                </div>
              )}
            </Card>
          </div>
        </div>
      )}
    </AppLayout>
  );
}

function defaultConfig(stationId: string) {
  return {
    station_id: stationId, enabled: false, integration_mode: "liquidsoap_lib", bypass: false,
    active_preset_id: null, binary_path: "", library_path: "", license_key_secret_name: "",
    input_source: "", output_target: "", sample_rate: 48000, latency_ms: 0,
    status: "unknown", docker_volume_path: "", custom_args: "",
  };
}
