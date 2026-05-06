import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { AppLayout } from "@/components/app-layout";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select";
import { EmptyState } from "@/components/data-states";
import { useAuth } from "@/lib/auth";
import { Mic, Radio, Plus, Trash2, Save, AlertTriangle, CalendarClock } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/live")({ component: LivePage });

type LiveInput = {
  id: string;
  station_id: string;
  mount_path: string;
  harbor_port: number;
  source_user: string;
  source_password: string;
  format: string;
  bitrate: number;
  auto_takeover: boolean;
  forced_takeover: boolean;
  fade_in_seconds: number;
  fade_out_seconds: number;
  is_enabled: boolean;
  is_live: boolean;
  last_state_change: string | null;
  notes: string | null;
};

function LivePage() {
  const qc = useQueryClient();
  const { roles } = useAuth();
  const canEdit = roles.includes("admin") || roles.includes("editor");
  const isAdmin = roles.includes("admin");
  const [stationId, setStationId] = useState<string>("");

  const stations = useQuery({
    queryKey: ["live-stations"],
    queryFn: async () => (await supabase.from("stations").select("id,name,slug").eq("is_active", true).order("name")).data ?? [],
  });

  // Auto-select first station
  if (!stationId && stations.data?.length) {
    setStationId(stations.data[0].id);
  }

  const liveInput = useQuery({
    queryKey: ["live-input", stationId], enabled: !!stationId, refetchInterval: 10_000,
    queryFn: async () => (await supabase.from("live_inputs").select("*").eq("station_id", stationId).maybeSingle()).data as LiveInput | null,
  });

  const schedule = useQuery({
    queryKey: ["live-schedule", stationId], enabled: !!stationId, refetchInterval: 30_000,
    queryFn: async () => (await supabase.from("live_takeover_schedule").select("*, presenters(name,color)").eq("station_id", stationId).order("starts_at", { ascending: true })).data ?? [],
  });

  const events = useQuery({
    queryKey: ["live-events", stationId], enabled: !!stationId, refetchInterval: 15_000,
    queryFn: async () => (await supabase.from("live_takeover_events").select("*").eq("station_id", stationId).order("created_at", { ascending: false }).limit(20)).data ?? [],
  });

  const presenters = useQuery({
    queryKey: ["presenters-list"],
    queryFn: async () => (await supabase.from("presenters").select("id,name").eq("is_active", true).order("name")).data ?? [],
  });

  const createInput = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("live_inputs").insert({ station_id: stationId });
      if (error) throw error;
    },
    onSuccess: () => { toast.success("Live input created"); qc.invalidateQueries({ queryKey: ["live-input", stationId] }); },
    onError: (e: any) => toast.error(e.message),
  });

  const saveInput = useMutation({
    mutationFn: async (patch: Partial<LiveInput>) => {
      const { error } = await supabase.from("live_inputs").update(patch).eq("station_id", stationId);
      if (error) throw error;
    },
    onSuccess: () => { toast.success("Saved"); qc.invalidateQueries({ queryKey: ["live-input", stationId] }); },
    onError: (e: any) => toast.error(e.message),
  });

  const toggleTakeover = useMutation({
    mutationFn: async (forced: boolean) => {
      const { error } = await supabase.from("live_inputs").update({
        forced_takeover: forced,
        last_state_change: new Date().toISOString(),
      }).eq("station_id", stationId);
      if (error) throw error;
      await supabase.from("live_takeover_events").insert({
        station_id: stationId,
        event_type: forced ? "takeover_forced" : "takeover_released",
        source: "manual",
        message: forced ? "Manual switch to live broadcast" : "Manual return to scheduled playout",
      });
    },
    onSuccess: (_d, forced) => {
      toast.success(forced ? "Switched to LIVE" : "Returned to scheduled playout");
      qc.invalidateQueries({ queryKey: ["live-input", stationId] });
      qc.invalidateQueries({ queryKey: ["live-events", stationId] });
    },
    onError: (e: any) => toast.error(e.message),
  });

  return (
    <AppLayout
      title="Live Broadcast / DJ Takeover"
      description="Switcha mellan schemalagd playout och live-källa via Liquidsoap harbor"
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
        <EmptyState title="Välj en station" description="Konfigurera live input per station." />
      ) : !liveInput.data ? (
        <Card className="p-6 text-center">
          <Mic className="w-8 h-8 mx-auto text-muted-foreground mb-2" />
          <h3 className="font-medium mb-1">Ingen live input konfigurerad</h3>
          <p className="text-sm text-muted-foreground mb-4">Skapa ett harbor-mountpoint så att DJ:s kan ansluta sin source client.</p>
          <Button disabled={!isAdmin} onClick={() => createInput.mutate()}>
            <Plus className="w-4 h-4 mr-2" /> Skapa live input
          </Button>
          {!isAdmin && <p className="text-xs text-muted-foreground mt-2">Endast admin kan skapa.</p>}
        </Card>
      ) : (
        <LiveInputPanel
          input={liveInput.data}
          canEdit={canEdit}
          onSave={(p) => saveInput.mutate(p)}
          onToggle={(v) => toggleTakeover.mutate(v)}
        />
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mt-4">
        <SchedulePanel
          stationId={stationId}
          schedule={schedule.data ?? []}
          presenters={presenters.data ?? []}
          canEdit={canEdit}
          isAdmin={isAdmin}
          onChanged={() => qc.invalidateQueries({ queryKey: ["live-schedule", stationId] })}
        />
        <EventsPanel events={events.data ?? []} />
      </div>
    </AppLayout>
  );
}

function LiveInputPanel({ input, canEdit, onSave, onToggle }: {
  input: LiveInput; canEdit: boolean;
  onSave: (p: Partial<LiveInput>) => void;
  onToggle: (forced: boolean) => void;
}) {
  const [draft, setDraft] = useState<LiveInput>(input);
  // Reset when input changes
  useMemo(() => setDraft(input), [input.id, input.is_live, input.forced_takeover, input.last_state_change]);
  const live = input.forced_takeover || input.is_live;

  return (
    <Card className="p-5 space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className={`w-3 h-3 rounded-full ${live ? "bg-red-500 animate-pulse" : "bg-emerald-500"}`} />
          <div>
            <div className="font-semibold flex items-center gap-2">
              {live ? "ON AIR — LIVE" : "Auto playout"}
              {input.forced_takeover && <Badge variant="destructive">FORCED</Badge>}
              {!input.forced_takeover && input.is_live && <Badge>auto</Badge>}
            </div>
            <div className="text-xs text-muted-foreground">
              Mount {input.mount_path} · port {input.harbor_port} · {input.format}@{input.bitrate}kbps
              {input.last_state_change && ` · sedan ${new Date(input.last_state_change).toLocaleTimeString()}`}
            </div>
          </div>
        </div>
        <div className="flex gap-2">
          {input.forced_takeover ? (
            <Button variant="outline" disabled={!canEdit} onClick={() => onToggle(false)}>
              <Radio className="w-4 h-4 mr-2" /> Återgå till playout
            </Button>
          ) : (
            <Button variant="destructive" disabled={!canEdit} onClick={() => onToggle(true)}>
              <Mic className="w-4 h-4 mr-2" /> Switcha till LIVE
            </Button>
          )}
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 pt-2 border-t border-border">
        <div>
          <Label className="text-xs">Mountpoint</Label>
          <Input value={draft.mount_path} disabled={!canEdit} onChange={(e) => setDraft({ ...draft, mount_path: e.target.value })} />
        </div>
        <div>
          <Label className="text-xs">Harbor port</Label>
          <Input type="number" value={draft.harbor_port} disabled={!canEdit} onChange={(e) => setDraft({ ...draft, harbor_port: Number(e.target.value) })} />
        </div>
        <div>
          <Label className="text-xs">Source user</Label>
          <Input value={draft.source_user} disabled={!canEdit} onChange={(e) => setDraft({ ...draft, source_user: e.target.value })} />
        </div>
        <div>
          <Label className="text-xs">Source password</Label>
          <Input type="password" value={draft.source_password} disabled={!canEdit} onChange={(e) => setDraft({ ...draft, source_password: e.target.value })} />
        </div>
        <div>
          <Label className="text-xs">Format</Label>
          <Select value={draft.format} onValueChange={(v) => setDraft({ ...draft, format: v })} disabled={!canEdit}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="mp3">mp3</SelectItem>
              <SelectItem value="ogg">ogg</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label className="text-xs">Bitrate (kbps)</Label>
          <Input type="number" value={draft.bitrate} disabled={!canEdit} onChange={(e) => setDraft({ ...draft, bitrate: Number(e.target.value) })} />
        </div>
        <div>
          <Label className="text-xs">Fade in (s)</Label>
          <Input type="number" step="0.1" value={draft.fade_in_seconds} disabled={!canEdit} onChange={(e) => setDraft({ ...draft, fade_in_seconds: Number(e.target.value) })} />
        </div>
        <div>
          <Label className="text-xs">Fade out (s)</Label>
          <Input type="number" step="0.1" value={draft.fade_out_seconds} disabled={!canEdit} onChange={(e) => setDraft({ ...draft, fade_out_seconds: Number(e.target.value) })} />
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-6 pt-2 border-t border-border">
        <label className="flex items-center gap-2 text-sm">
          <Switch checked={draft.is_enabled} disabled={!canEdit} onCheckedChange={(v) => setDraft({ ...draft, is_enabled: v })} />
          Live input enabled
        </label>
        <label className="flex items-center gap-2 text-sm">
          <Switch checked={draft.auto_takeover} disabled={!canEdit} onCheckedChange={(v) => setDraft({ ...draft, auto_takeover: v })} />
          Auto-takeover när källa ansluter
        </label>
        <Button className="ml-auto" disabled={!canEdit} onClick={() => onSave(draft)}>
          <Save className="w-4 h-4 mr-2" /> Spara konfiguration
        </Button>
      </div>

      <div className="text-xs text-muted-foreground bg-muted/40 border border-border rounded p-3 flex gap-2">
        <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
        Ändringar appliceras nästa gång runnern hämtar config (≤30 s) — Liquidsoap reloadas automatiskt.
        För manuell switch utan reload använder runnern telnet: <code className="font-mono">var.set force_live = true</code>.
      </div>
    </Card>
  );
}

function SchedulePanel({ stationId, schedule, presenters, canEdit, isAdmin, onChanged }: {
  stationId: string;
  schedule: any[];
  presenters: { id: string; name: string }[];
  canEdit: boolean;
  isAdmin: boolean;
  onChanged: () => void;
}) {
  const [adding, setAdding] = useState(false);
  const [form, setForm] = useState({ title: "", presenter_id: "", starts_at: "", ends_at: "", auto_activate: true, notes: "" });

  const create = async () => {
    if (!form.title || !form.starts_at || !form.ends_at) { toast.error("Title + tider krävs"); return; }
    const { error } = await supabase.from("live_takeover_schedule").insert({
      station_id: stationId,
      title: form.title,
      presenter_id: form.presenter_id || null,
      starts_at: new Date(form.starts_at).toISOString(),
      ends_at: new Date(form.ends_at).toISOString(),
      auto_activate: form.auto_activate,
      notes: form.notes || null,
    });
    if (error) { toast.error(error.message); return; }
    toast.success("Live-pass schemalagt");
    setAdding(false);
    setForm({ title: "", presenter_id: "", starts_at: "", ends_at: "", auto_activate: true, notes: "" });
    onChanged();
  };

  const remove = async (id: string) => {
    const { error } = await supabase.from("live_takeover_schedule").delete().eq("id", id);
    if (error) { toast.error(error.message); return; }
    toast.success("Borttaget"); onChanged();
  };

  const now = Date.now();

  return (
    <Card className="p-5">
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-sm font-semibold flex items-center gap-2"><CalendarClock className="w-4 h-4" /> Schemalagda live-pass</h2>
        <Button size="sm" variant="outline" disabled={!canEdit} onClick={() => setAdding((v) => !v)}>
          <Plus className="w-4 h-4 mr-1" /> Nytt pass
        </Button>
      </div>

      {adding && (
        <div className="border border-border rounded-md p-3 mb-3 space-y-2 bg-muted/30">
          <Input placeholder="Titel (t.ex. Morgonshow)" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} />
          <div className="grid grid-cols-2 gap-2">
            <Input type="datetime-local" value={form.starts_at} onChange={(e) => setForm({ ...form, starts_at: e.target.value })} />
            <Input type="datetime-local" value={form.ends_at} onChange={(e) => setForm({ ...form, ends_at: e.target.value })} />
          </div>
          <Select value={form.presenter_id} onValueChange={(v) => setForm({ ...form, presenter_id: v })}>
            <SelectTrigger><SelectValue placeholder="Presenter (valfri)" /></SelectTrigger>
            <SelectContent>
              {presenters.map((p) => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}
            </SelectContent>
          </Select>
          <Textarea placeholder="Notes" value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
          <label className="flex items-center gap-2 text-sm">
            <Switch checked={form.auto_activate} onCheckedChange={(v) => setForm({ ...form, auto_activate: v })} />
            Auto-aktivera takeover under passet
          </label>
          <div className="flex gap-2 justify-end">
            <Button size="sm" variant="ghost" onClick={() => setAdding(false)}>Avbryt</Button>
            <Button size="sm" onClick={create}>Spara</Button>
          </div>
        </div>
      )}

      <div className="divide-y divide-border max-h-[55vh] overflow-y-auto">
        {schedule.length === 0 && <EmptyState title="Inga schemalagda live-pass" />}
        {schedule.map((s: any) => {
          const start = new Date(s.starts_at).getTime();
          const end = new Date(s.ends_at).getTime();
          const status = now < start ? "upcoming" : now > end ? "past" : "live";
          return (
            <div key={s.id} className="py-3 flex items-start justify-between gap-3">
              <div className="min-w-0">
                <div className="font-medium flex items-center gap-2">
                  {s.title}
                  {status === "live" && <Badge variant="destructive">NU</Badge>}
                  {status === "upcoming" && <Badge variant="secondary">kommande</Badge>}
                  {status === "past" && <Badge variant="outline">avslutad</Badge>}
                  {!s.auto_activate && <Badge variant="outline" className="text-[10px]">manuell</Badge>}
                </div>
                <div className="text-xs text-muted-foreground">
                  {new Date(s.starts_at).toLocaleString()} → {new Date(s.ends_at).toLocaleString()}
                  {s.presenters?.name && <> · {s.presenters.name}</>}
                </div>
                {s.notes && <div className="text-xs mt-1 italic text-muted-foreground">{s.notes}</div>}
              </div>
              <Button size="icon" variant="ghost" disabled={!isAdmin} onClick={() => remove(s.id)}>
                <Trash2 className="w-4 h-4" />
              </Button>
            </div>
          );
        })}
      </div>
    </Card>
  );
}

function EventsPanel({ events }: { events: any[] }) {
  return (
    <Card className="p-5">
      <h2 className="text-sm font-semibold mb-3">Takeover-historik</h2>
      <div className="divide-y divide-border max-h-[55vh] overflow-y-auto">
        {events.length === 0 && <EmptyState title="Inga händelser ännu" />}
        {events.map((e) => (
          <div key={e.id} className="py-2 text-sm">
            <div className="flex items-center justify-between">
              <span className="font-medium">{e.event_type}</span>
              <span className="text-xs text-muted-foreground">{new Date(e.created_at).toLocaleString()}</span>
            </div>
            <div className="text-xs text-muted-foreground">{e.source}{e.message ? ` · ${e.message}` : ""}</div>
          </div>
        ))}
      </div>
    </Card>
  );
}
