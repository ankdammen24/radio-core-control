import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { AppLayout } from "@/components/app-layout";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/data-states";
import { useState } from "react";
import { toast } from "sonner";
import { CalendarClock, Plus, GripVertical, Trash2 } from "lucide-react";

export const Route = createFileRoute("/episodes")({ component: EpisodesPage });

function EpisodesPage() {
  const qc = useQueryClient();
  const [showId, setShowId] = useState<string>("");
  const [start, setStart] = useState("");
  const [end, setEnd] = useState("");
  const [selectedEpisode, setSelectedEpisode] = useState<string>("");

  const shows = useQuery({ queryKey: ["shows-min"], queryFn: async () => (await supabase.from("shows").select("id,name,color").order("name")).data ?? [] });
  const episodes = useQuery({
    queryKey: ["episodes"],
    queryFn: async () => (await supabase.from("episodes").select("*, shows(name,color)").order("scheduled_start", { ascending: false }).limit(50)).data ?? [],
  });
  const rundown = useQuery({
    queryKey: ["rundown", selectedEpisode], enabled: !!selectedEpisode,
    queryFn: async () => (await supabase.from("rundown_items").select("*").eq("episode_id", selectedEpisode).order("position")).data ?? [],
  });

  const createEp = useMutation({
    mutationFn: async () => {
      if (!showId || !start || !end) throw new Error("Show + start + end required");
      const { error } = await supabase.from("episodes").insert({ show_id: showId, scheduled_start: start, scheduled_end: end });
      if (error) throw error;
    },
    onSuccess: () => { toast.success("Episode planned"); qc.invalidateQueries({ queryKey: ["episodes"] }); },
    onError: (e: any) => toast.error(e.message),
  });

  const [item, setItem] = useState({ title: "", item_type: "talk", duration_seconds: 60 });
  const addItem = useMutation({
    mutationFn: async () => {
      if (!selectedEpisode || !item.title) throw new Error("Episode + title required");
      const pos = (rundown.data?.length ?? 0);
      const { error } = await supabase.from("rundown_items").insert({ episode_id: selectedEpisode, position: pos, ...item });
      if (error) throw error;
    },
    onSuccess: () => { toast.success("Item added"); setItem({ title: "", item_type: "talk", duration_seconds: 60 }); qc.invalidateQueries({ queryKey: ["rundown", selectedEpisode] }); },
    onError: (e: any) => toast.error(e.message),
  });
  const delItem = useMutation({
    mutationFn: async (id: string) => { const { error } = await supabase.from("rundown_items").delete().eq("id", id); if (error) throw error; },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["rundown", selectedEpisode] }),
  });

  const totalDur = (rundown.data ?? []).reduce((a: number, r: any) => a + (r.duration_seconds || 0), 0);

  return (
    <AppLayout title="Episodes" description="Plan sändningar och bygg körscheman (rundowns)">
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card className="p-4">
          <h2 className="text-sm font-semibold mb-3 flex items-center gap-2"><CalendarClock className="w-4 h-4" /> Plan episode</h2>
          <div className="grid grid-cols-2 gap-2 mb-3">
            <Select value={showId} onValueChange={setShowId}>
              <SelectTrigger className="col-span-2"><SelectValue placeholder="Show" /></SelectTrigger>
              <SelectContent>{(shows.data ?? []).map((s: any) => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}</SelectContent>
            </Select>
            <Input type="datetime-local" value={start} onChange={(e) => setStart(e.target.value)} />
            <Input type="datetime-local" value={end} onChange={(e) => setEnd(e.target.value)} />
          </div>
          <Button onClick={() => createEp.mutate()}><Plus className="w-4 h-4 mr-2" /> Create</Button>

          <div className="mt-4 divide-y divide-border max-h-[50vh] overflow-y-auto">
            {(episodes.data ?? []).length === 0 && <EmptyState title="No episodes" />}
            {(episodes.data ?? []).map((e: any) => (
              <button key={e.id} onClick={() => setSelectedEpisode(e.id)}
                className={`w-full text-left py-2 px-2 rounded ${selectedEpisode === e.id ? "bg-accent" : "hover:bg-accent/40"}`}>
                <div className="flex items-center justify-between">
                  <span className="font-medium text-sm">{e.shows?.name}</span>
                  <Badge variant="outline">{e.status}</Badge>
                </div>
                <div className="text-xs text-muted-foreground">{new Date(e.scheduled_start).toLocaleString()}</div>
              </button>
            ))}
          </div>
        </Card>

        <Card className="p-4">
          <h2 className="text-sm font-semibold mb-3">Rundown {selectedEpisode ? `(${Math.round(totalDur/60)} min)` : ""}</h2>
          {!selectedEpisode ? <EmptyState title="Pick an episode" description="Select an episode to edit its rundown" />
            : <>
                <div className="grid grid-cols-12 gap-2 mb-3">
                  <Input className="col-span-6" placeholder="Title" value={item.title} onChange={(e) => setItem({ ...item, title: e.target.value })} />
                  <Select value={item.item_type} onValueChange={(v) => setItem({ ...item, item_type: v })}>
                    <SelectTrigger className="col-span-3"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {["talk","music","jingle","ad","interview","news","weather"].map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}
                    </SelectContent>
                  </Select>
                  <Input className="col-span-2" type="number" min={0} value={item.duration_seconds} onChange={(e) => setItem({ ...item, duration_seconds: Number(e.target.value) })} />
                  <Button className="col-span-1" size="icon" onClick={() => addItem.mutate()}><Plus className="w-4 h-4" /></Button>
                </div>
                <ol className="space-y-1">
                  {(rundown.data ?? []).map((r: any, i: number) => (
                    <li key={r.id} className="flex items-center gap-2 border border-border rounded px-2 py-1.5 text-sm">
                      <GripVertical className="w-4 h-4 text-muted-foreground" />
                      <span className="text-xs text-muted-foreground w-6">{i + 1}</span>
                      <Badge variant="secondary" className="text-[10px]">{r.item_type}</Badge>
                      <span className="flex-1 truncate">{r.title}</span>
                      <span className="text-xs text-muted-foreground">{r.duration_seconds}s</span>
                      <Button size="icon" variant="ghost" onClick={() => delItem.mutate(r.id)}><Trash2 className="w-3 h-3" /></Button>
                    </li>
                  ))}
                  {(rundown.data ?? []).length === 0 && <li className="text-sm text-muted-foreground">Empty rundown</li>}
                </ol>
              </>}
        </Card>
      </div>
    </AppLayout>
  );
}
