import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { AppLayout } from "@/components/app-layout";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { EmptyState } from "@/components/data-states";
import { useState } from "react";
import { toast } from "sonner";
import { Mic, Plus } from "lucide-react";

export const Route = createFileRoute("/shows")({ component: ShowsPage });

function ShowsPage() {
  const qc = useQueryClient();
  const [form, setForm] = useState({ name: "", description: "", station_id: "", presenter_id: "", color: "#3b82f6" });

  const stations = useQuery({ queryKey: ["stations-list"], queryFn: async () => (await supabase.from("stations").select("id,name").order("name")).data ?? [] });
  const presenters = useQuery({ queryKey: ["presenters"], queryFn: async () => (await supabase.from("presenters").select("*").order("name")).data ?? [] });
  const shows = useQuery({
    queryKey: ["shows"],
    queryFn: async () => (await supabase.from("shows").select("*, stations(name), presenters(name)").order("name")).data ?? [],
  });

  const createShow = useMutation({
    mutationFn: async () => {
      if (!form.name || !form.station_id) throw new Error("Name and station required");
      const { error } = await supabase.from("shows").insert({
        name: form.name, description: form.description, station_id: form.station_id,
        presenter_id: form.presenter_id || null, color: form.color,
      });
      if (error) throw error;
    },
    onSuccess: () => { toast.success("Show created"); setForm({ name: "", description: "", station_id: "", presenter_id: "", color: "#3b82f6" }); qc.invalidateQueries({ queryKey: ["shows"] }); },
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

  return (
    <AppLayout title="Shows & Rundowns" description="Programs, presenters and rundown planning">
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <Card className="p-4 lg:col-span-2">
          <h2 className="text-sm font-semibold mb-3 flex items-center gap-2"><Mic className="w-4 h-4" /> Shows</h2>
          <div className="grid grid-cols-2 gap-2 mb-3">
            <Input placeholder="Show name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
            <Select value={form.station_id} onValueChange={(v) => setForm({ ...form, station_id: v })}>
              <SelectTrigger><SelectValue placeholder="Station" /></SelectTrigger>
              <SelectContent>{(stations.data ?? []).map((s) => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}</SelectContent>
            </Select>
            <Select value={form.presenter_id} onValueChange={(v) => setForm({ ...form, presenter_id: v })}>
              <SelectTrigger><SelectValue placeholder="Presenter (optional)" /></SelectTrigger>
              <SelectContent>{(presenters.data ?? []).map((p: any) => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}</SelectContent>
            </Select>
            <Input type="color" value={form.color} onChange={(e) => setForm({ ...form, color: e.target.value })} />
            <Textarea className="col-span-2" placeholder="Description" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
          </div>
          <Button onClick={() => createShow.mutate()}><Plus className="w-4 h-4 mr-2" /> Create show</Button>

          <div className="mt-4 divide-y divide-border">
            {(shows.data ?? []).length === 0 && <EmptyState title="No shows yet" />}
            {(shows.data ?? []).map((s: any) => (
              <div key={s.id} className="py-3 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <span className="w-3 h-3 rounded-full" style={{ background: s.color ?? "#3b82f6" }} />
                  <div>
                    <div className="font-medium">{s.name}</div>
                    <div className="text-xs text-muted-foreground">{s.stations?.name} · {s.presenters?.name ?? "no presenter"}</div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </Card>

        <Card className="p-4">
          <h2 className="text-sm font-semibold mb-3">Presenters</h2>
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
    </AppLayout>
  );
}
