import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { ResourcePageShell } from "@/components/resource-page-shell";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { Mic, Plus } from "lucide-react";
import { useStationScope } from "@/lib/station-context";

export const Route = createFileRoute("/shows")({ component: ShowsPage });

function ShowsPage() {
  const qc = useQueryClient();
  const { scope } = useStationScope();
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const [form, setForm] = useState({ name: "", description: "", station_id: "", presenter_id: "", color: "#3b82f6" });

  const stations = useQuery({ queryKey: ["stations-list"], queryFn: async () => (await supabase.from("stations").select("id,name").order("name")).data ?? [] });
  const presenters = useQuery({ queryKey: ["presenters"], queryFn: async () => (await supabase.from("presenters").select("*").order("name")).data ?? [] });
  const shows = useQuery({
    queryKey: ["shows"],
    queryFn: async () => {
      const { data, error } = await supabase.from("shows").select("*, stations(name), presenters(name)").order("name");
      if (error) throw error;
      return data ?? [];
    },
  });

  const filtered = useMemo(() => (shows.data ?? []).filter((s: any) => {
    if (scope.kind === "station" && s.station_id !== scope.station.id) return false;
    if (q && !s.name.toLowerCase().includes(q.toLowerCase())) return false;
    return true;
  }), [shows.data, q, scope]);

  const createShow = useMutation({
    mutationFn: async () => {
      if (!form.name || !form.station_id) throw new Error("Name and station required");
      const { error } = await supabase.from("shows").insert({
        name: form.name, description: form.description, station_id: form.station_id,
        presenter_id: form.presenter_id || null, color: form.color,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Show created");
      setOpen(false);
      setForm({ name: "", description: "", station_id: "", presenter_id: "", color: "#3b82f6" });
      qc.invalidateQueries({ queryKey: ["shows"] });
    },
    onError: (e: any) => toast.error(e.message),
  });

  const [pname, setPname] = useState("");
  const addPresenter = useMutation({
    mutationFn: async () => {
      if (!pname.trim()) throw new Error("Name required");
      const { error } = await supabase.from("presenters").insert({ name: pname.trim() });
      if (error) throw error;
    },
    onSuccess: () => { toast.success("Presenter added"); setPname(""); qc.invalidateQueries({ queryKey: ["presenters"] }); },
    onError: (e: any) => toast.error(e.message),
  });

  const state =
    shows.isLoading ? { kind: "loading" as const } :
    shows.error ? { kind: "error" as const, message: (shows.error as Error).message, retry: () => shows.refetch() } :
    filtered.length === 0 ? { kind: "empty" as const, title: "No shows yet", hint: "Create a show to plan recurring programming." } :
    { kind: "ready" as const };

  const primaryAction = (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild><Button size="sm"><Plus className="w-4 h-4 mr-1" /> New show</Button></DialogTrigger>
      <DialogContent>
        <DialogHeader><DialogTitle>New show</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <div><Label>Name *</Label><Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></div>
          <div><Label>Station *</Label>
            <Select value={form.station_id} onValueChange={(v) => setForm({ ...form, station_id: v })}>
              <SelectTrigger><SelectValue placeholder="Station" /></SelectTrigger>
              <SelectContent>{(stations.data ?? []).map((s) => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div><Label>Presenter</Label>
            <Select value={form.presenter_id} onValueChange={(v) => setForm({ ...form, presenter_id: v })}>
              <SelectTrigger><SelectValue placeholder="(optional)" /></SelectTrigger>
              <SelectContent>{(presenters.data ?? []).map((p: any) => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div><Label>Color</Label><Input type="color" value={form.color} onChange={(e) => setForm({ ...form, color: e.target.value })} /></div>
          <div><Label>Description</Label><Textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} /></div>
        </div>
        <DialogFooter><Button onClick={() => createShow.mutate()} disabled={createShow.isPending}>{createShow.isPending ? "Creating…" : "Create"}</Button></DialogFooter>
      </DialogContent>
    </Dialog>
  );

  return (
    <ResourcePageShell
      title="Shows"
      description="Recurring programs and presenters."
      primaryAction={primaryAction}
      searchValue={q}
      onSearchChange={setQ}
      searchPlaceholder="Search shows…"
      state={{ kind: "ready" }}
      wrapContent={false}
    >
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <Card className="p-5 lg:col-span-2">
          <div className="flex items-center justify-between mb-3">
            <h2 className="font-semibold text-sm flex items-center gap-2"><Mic className="w-4 h-4 text-muted-foreground" /> Shows</h2>
          </div>
          {state.kind === "loading" && <div className="text-sm text-muted-foreground py-6">Loading…</div>}
          {state.kind === "error" && <div className="text-sm text-destructive py-6">{state.message}</div>}
          {state.kind === "empty" && <div className="text-sm text-muted-foreground py-6">{state.title}</div>}
          {state.kind === "ready" && (
            <div className="divide-y divide-border">
              {filtered.map((s: any) => (
                <div key={s.id} className="py-3 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <span className="w-2.5 h-2.5 rounded-full" style={{ background: s.color ?? "var(--accent)" }} />
                    <div>
                      <div className="font-medium text-sm">{s.name}</div>
                      <div className="text-xs text-muted-foreground">{s.stations?.name} · {s.presenters?.name ?? "no presenter"}</div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </Card>

        <Card className="p-5">
          <h2 className="font-semibold text-sm mb-3">Presenters</h2>
          <div className="flex gap-2 mb-3">
            <Input placeholder="Name" value={pname} onChange={(e) => setPname(e.target.value)} />
            <Button onClick={() => addPresenter.mutate()}>Add</Button>
          </div>
          <ul className="text-sm divide-y divide-border">
            {(presenters.data ?? []).map((p: any) => <li key={p.id} className="py-2">{p.name}</li>)}
            {(presenters.data ?? []).length === 0 && <li className="text-muted-foreground py-2">None yet</li>}
          </ul>
        </Card>
      </div>
    </ResourcePageShell>
  );
}
