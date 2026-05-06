import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import {
  listStreamingAdapters, probeStreamingOutput, renderOutputPreview,
} from "@/server/streaming-outputs.functions";
import { AppLayout } from "@/components/app-layout";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { PlaceholderNotice } from "@/components/placeholder-notice";
import { useAuth } from "@/lib/auth";
import { Plus, Trash2, Activity, FileCode2, RefreshCw, Radio } from "lucide-react";

export const Route = createFileRoute("/streaming-outputs")({ component: StreamingOutputsPage });

type Output = {
  id: string; station_id: string; type: string; name: string;
  is_enabled: boolean; is_public: boolean;
  host: string; port: number; mountpoint: string | null;
  username: string | null; password: string | null; password_secret_name: string | null;
  codec: string; format: string; bitrate: number; sample_rate: number; channels: number;
  use_tls: boolean; proxy_url: string | null; listener_stats_url: string | null;
  health_status: string; last_health_at: string | null; last_listeners: number | null;
  priority: number; notes: string | null;
};

const healthColor: Record<string, string> = {
  healthy: "bg-green-500/15 text-green-700 dark:text-green-400 border-green-500/30",
  degraded: "bg-yellow-500/15 text-yellow-700 dark:text-yellow-400 border-yellow-500/30",
  down: "bg-red-500/15 text-red-700 dark:text-red-400 border-red-500/30",
  unknown: "bg-muted text-muted-foreground border-border",
};

function StreamingOutputsPage() {
  const { isAdmin } = useAuth();
  const qc = useQueryClient();
  const [stationId, setStationId] = useState("");

  const { data: stations } = useQuery({
    queryKey: ["stations-streaming-outputs"],
    queryFn: async () =>
      (await supabase.from("stations").select("id,name,slug").eq("is_active", true).order("name")).data ?? [],
  });

  const { data: adapters } = useQuery({
    queryKey: ["streaming-adapters"],
    queryFn: async () => (await listStreamingAdapters()) as any[],
  });

  const outputs = useQuery({
    queryKey: ["streaming-outputs", stationId],
    enabled: !!stationId,
    queryFn: async () =>
      ((await supabase.from("streaming_outputs").select("*").eq("station_id", stationId).order("priority"))
        .data ?? []) as Output[],
  });

  const addOutput = useMutation({
    mutationFn: async (type: string) => {
      const { error } = await supabase.from("streaming_outputs").insert({
        station_id: stationId,
        type,
        name: `${type}-${Date.now().toString(36).slice(-4)}`,
        mountpoint: type === "icecast_kh" || type === "icecast" ? "/stream.mp3" : null,
      } as any);
      if (error) throw new Error(error.message);
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["streaming-outputs", stationId] }); toast.success("Output added"); },
    onError: (e: any) => toast.error(e.message),
  });

  const updateOutput = useMutation({
    mutationFn: async ({ id, patch }: { id: string; patch: Partial<Output> }) => {
      const { error } = await supabase.from("streaming_outputs").update(patch as any).eq("id", id);
      if (error) throw new Error(error.message);
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["streaming-outputs", stationId] }),
    onError: (e: any) => toast.error(e.message),
  });

  const deleteOutput = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("streaming_outputs").delete().eq("id", id);
      if (error) throw new Error(error.message);
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["streaming-outputs", stationId] }); toast.success("Removed"); },
  });

  const probeFn = useServerFn(probeStreamingOutput);
  const previewFn = useServerFn(renderOutputPreview);

  const probe = useMutation({
    mutationFn: async (id: string) => (await probeFn({ data: { outputId: id } })) as any,
    onSuccess: (r) => {
      qc.invalidateQueries({ queryKey: ["streaming-outputs", stationId] });
      toast.success(`Health: ${r.status}${r.listeners != null ? ` · ${r.listeners} listeners` : ""}${r.message ? ` · ${r.message}` : ""}`);
    },
    onError: (e: any) => toast.error(e.message),
  });

  const [preview, setPreview] = useState<{ name: string; liq: string; publicUrl: string | null } | null>(null);
  const showPreview = useMutation({
    mutationFn: async (o: Output) => {
      const r = await previewFn({ data: { outputId: o.id } }) as any;
      return { name: o.name, liq: r.liq, publicUrl: r.publicUrl };
    },
    onSuccess: (r) => setPreview(r),
    onError: (e: any) => toast.error(e.message),
  });

  return (
    <AppLayout title="Streaming Outputs" description="Pluggable per-station streaming destinations (Icecast, SHOUTcast, HLS, relay, SRT, RTMP, WebRTC)">
      <PlaceholderNotice title="Adapter-based architecture">
        Each station can run multiple streaming destinations side-by-side. Icecast-KH is the default
        reference implementation; other adapters (Icecast, SHOUTcast, HLS, External Relay, SRT, RTMP,
        WebRTC) are available and used by the config generator and runner.
      </PlaceholderNotice>

      <Card className="p-4 mt-4 mb-4">
        <div className="flex items-end gap-3 flex-wrap">
          <div className="min-w-72">
            <Label className="text-xs uppercase text-muted-foreground">Station</Label>
            <Select value={stationId} onValueChange={setStationId}>
              <SelectTrigger><SelectValue placeholder="Select a station" /></SelectTrigger>
              <SelectContent>
                {(stations ?? []).map((s) => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>

          {stationId && isAdmin && (
            <div className="min-w-64">
              <Label className="text-xs uppercase text-muted-foreground">Add output</Label>
              <Select value="" onValueChange={(v) => addOutput.mutate(v)}>
                <SelectTrigger><SelectValue placeholder="Choose adapter type…" /></SelectTrigger>
                <SelectContent>
                  {(adapters ?? []).map((a) => (
                    <SelectItem key={a.type} value={a.type}>
                      {a.label} <span className="text-muted-foreground text-xs ml-2">{a.description}</span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}
        </div>
      </Card>

      <div className="space-y-3">
        {(outputs.data ?? []).map((o) => {
          const adapter = adapters?.find((a) => a.type === o.type);
          return (
            <Card key={o.id} className="p-4">
              <div className="flex items-center justify-between gap-3 mb-3 flex-wrap">
                <div className="flex items-center gap-2">
                  <Radio className="w-4 h-4" />
                  <Input
                    className="font-semibold w-56"
                    value={o.name}
                    disabled={!isAdmin}
                    onChange={(e) => updateOutput.mutate({ id: o.id, patch: { name: e.target.value } })}
                  />
                  <Badge variant="outline">{adapter?.label ?? o.type}</Badge>
                  <Badge variant="outline" className={healthColor[o.health_status] ?? healthColor.unknown}>
                    {o.health_status}{o.last_listeners != null ? ` · ${o.last_listeners}` : ""}
                  </Badge>
                  {!adapter?.capabilities?.liquidsoap && (
                    <Badge variant="outline" className="text-xs">external</Badge>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  <div className="flex items-center gap-2 text-xs">
                    <Switch checked={o.is_enabled} disabled={!isAdmin}
                      onCheckedChange={(v) => updateOutput.mutate({ id: o.id, patch: { is_enabled: v } })} />
                    <span>Enabled</span>
                  </div>
                  <Button size="sm" variant="outline" onClick={() => probe.mutate(o.id)}>
                    <Activity className="w-4 h-4 mr-1" /> Probe
                  </Button>
                  <Button size="sm" variant="outline" onClick={() => showPreview.mutate(o)}>
                    <FileCode2 className="w-4 h-4 mr-1" /> Liq
                  </Button>
                  {isAdmin && (
                    <Button size="sm" variant="ghost" onClick={() => confirm("Delete output?") && deleteOutput.mutate(o.id)}>
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  )}
                </div>
              </div>

              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <Field label="Host">
                  <Input value={o.host} disabled={!isAdmin}
                    onChange={(e) => updateOutput.mutate({ id: o.id, patch: { host: e.target.value } })} />
                </Field>
                <Field label="Port">
                  <Input type="number" value={o.port} disabled={!isAdmin}
                    onChange={(e) => updateOutput.mutate({ id: o.id, patch: { port: Number(e.target.value) } })} />
                </Field>
                <Field label="Mountpoint">
                  <Input value={o.mountpoint ?? ""} disabled={!isAdmin}
                    onChange={(e) => updateOutput.mutate({ id: o.id, patch: { mountpoint: e.target.value || null } })} />
                </Field>
                <Field label="Username">
                  <Input value={o.username ?? ""} disabled={!isAdmin}
                    onChange={(e) => updateOutput.mutate({ id: o.id, patch: { username: e.target.value || null } })} />
                </Field>
                <Field label="Password">
                  <Input type="password" value={o.password ?? ""} disabled={!isAdmin}
                    placeholder={o.password_secret_name ? `secret: ${o.password_secret_name}` : ""}
                    onChange={(e) => updateOutput.mutate({ id: o.id, patch: { password: e.target.value || null } })} />
                </Field>
                <Field label="Password secret ref">
                  <Input value={o.password_secret_name ?? ""} disabled={!isAdmin}
                    placeholder="OUTPUT_X_PASSWORD"
                    onChange={(e) => updateOutput.mutate({ id: o.id, patch: { password_secret_name: e.target.value || null } })} />
                </Field>
                <Field label="Codec">
                  <Select value={o.codec} disabled={!isAdmin}
                    onValueChange={(v) => updateOutput.mutate({ id: o.id, patch: { codec: v } })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {["mp3","aac","opus","ogg","flac","h264+aac"].map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </Field>
                <Field label="Format / MIME">
                  <Input value={o.format} disabled={!isAdmin}
                    onChange={(e) => updateOutput.mutate({ id: o.id, patch: { format: e.target.value } })} />
                </Field>
                <Field label="Bitrate">
                  <Input type="number" value={o.bitrate} disabled={!isAdmin}
                    onChange={(e) => updateOutput.mutate({ id: o.id, patch: { bitrate: Number(e.target.value) } })} />
                </Field>
                <Field label="Sample rate">
                  <Input type="number" value={o.sample_rate} disabled={!isAdmin}
                    onChange={(e) => updateOutput.mutate({ id: o.id, patch: { sample_rate: Number(e.target.value) } })} />
                </Field>
                <Field label="Channels">
                  <Select value={String(o.channels)} disabled={!isAdmin}
                    onValueChange={(v) => updateOutput.mutate({ id: o.id, patch: { channels: Number(v) } })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="1">1 (mono)</SelectItem>
                      <SelectItem value="2">2 (stereo)</SelectItem>
                    </SelectContent>
                  </Select>
                </Field>
                <Field label="Priority">
                  <Input type="number" value={o.priority} disabled={!isAdmin}
                    onChange={(e) => updateOutput.mutate({ id: o.id, patch: { priority: Number(e.target.value) } })} />
                </Field>
                <Field label="Listener stats URL (override)">
                  <Input value={o.listener_stats_url ?? ""} disabled={!isAdmin}
                    onChange={(e) => updateOutput.mutate({ id: o.id, patch: { listener_stats_url: e.target.value || null } })} />
                </Field>
                <Field label="Proxy URL">
                  <Input value={o.proxy_url ?? ""} disabled={!isAdmin}
                    onChange={(e) => updateOutput.mutate({ id: o.id, patch: { proxy_url: e.target.value || null } })} />
                </Field>
                <Field label="TLS">
                  <div className="flex items-center h-10 gap-2">
                    <Switch checked={o.use_tls} disabled={!isAdmin}
                      onCheckedChange={(v) => updateOutput.mutate({ id: o.id, patch: { use_tls: v } })} />
                    <span className="text-xs text-muted-foreground">{o.use_tls ? "https" : "http"}</span>
                  </div>
                </Field>
                <Field label="Public listing">
                  <div className="flex items-center h-10 gap-2">
                    <Switch checked={o.is_public} disabled={!isAdmin}
                      onCheckedChange={(v) => updateOutput.mutate({ id: o.id, patch: { is_public: v } })} />
                    <span className="text-xs text-muted-foreground">{o.is_public ? "public" : "private"}</span>
                  </div>
                </Field>
              </div>
            </Card>
          );
        })}

        {stationId && outputs.data?.length === 0 && (
          <Card className="p-8 text-center text-sm text-muted-foreground">
            No outputs yet — add one above. <Plus className="inline w-4 h-4" />
          </Card>
        )}
      </div>

      {preview && (
        <Card className="p-4 mt-4">
          <div className="flex items-center justify-between mb-2">
            <div className="font-semibold flex items-center gap-2">
              <FileCode2 className="w-4 h-4" /> Liquidsoap snippet — {preview.name}
            </div>
            <div className="flex items-center gap-2">
              {preview.publicUrl && <Badge variant="outline">{preview.publicUrl}</Badge>}
              <Button size="sm" variant="ghost" onClick={() => setPreview(null)}>
                <RefreshCw className="w-4 h-4" />
              </Button>
            </div>
          </div>
          <Textarea readOnly value={preview.liq} className="font-mono text-xs min-h-[220px]" />
        </Card>
      )}
    </AppLayout>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <Label className="text-[11px] uppercase tracking-wider text-muted-foreground">{label}</Label>
      <div className="mt-1">{children}</div>
    </div>
  );
}
