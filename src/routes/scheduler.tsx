import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { AppLayout } from "@/components/app-layout";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, Trash2 } from "lucide-react";
import { useState } from "react";
import { useAuth } from "@/lib/auth";
import { toast } from "sonner";

export const Route = createFileRoute("/scheduler")({ component: SchedulerPage });

const DAYS = [["mon","Mon"],["tue","Tue"],["wed","Wed"],["thu","Thu"],["fri","Fri"],["sat","Sat"],["sun","Sun"]] as const;

function SchedulerPage() {
  const qc = useQueryClient();
  const { isEditor } = useAuth();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ name:"", day_of_week:"mon", start_time:"06:00", end_time:"10:00", station_id:"", playlist_id:"", rotation_rule_id:"" });

  const { data: stations } = useQuery({ queryKey:["stations-list"], queryFn: async () => (await supabase.from("stations").select("id,name")).data ?? [] });
  const { data: playlists } = useQuery({ queryKey:["playlists-list"], queryFn: async () => (await supabase.from("playlists").select("id,name")).data ?? [] });
  const { data: rules } = useQuery({ queryKey:["rules-list"], queryFn: async () => (await supabase.from("rotation_rules").select("id,name")).data ?? [] });
  const { data: blocks } = useQuery({
    queryKey:["schedule_blocks"],
    queryFn: async () => (await supabase.from("schedule_blocks").select("*, playlists(name), rotation_rules(name)").order("day_of_week").order("start_time")).data ?? [],
  });

  const create = useMutation({
    mutationFn: async () => {
      const payload = { ...form, playlist_id: form.playlist_id || null, rotation_rule_id: form.rotation_rule_id || null };
      const { error } = await supabase.from("schedule_blocks").insert(payload as any);
      if (error) throw error;
    },
    onSuccess: () => { toast.success("Block added"); setOpen(false); qc.invalidateQueries({ queryKey:["schedule_blocks"] }); },
    onError: (e: any) => toast.error(e.message),
  });
  const del = useMutation({
    mutationFn: async (id: string) => { const { error } = await supabase.from("schedule_blocks").delete().eq("id", id); if (error) throw error; },
    onSuccess: () => qc.invalidateQueries({ queryKey:["schedule_blocks"] }),
  });

  const byDay: Record<string, any[]> = {};
  DAYS.forEach(([d]) => byDay[d] = []);
  blocks?.forEach((b: any) => byDay[b.day_of_week]?.push(b));

  return (
    <AppLayout title="Scheduler" description="Weekly programming blocks across stations." actions={
      isEditor && (
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild><Button size="sm"><Plus className="w-4 h-4 mr-1" />New Block</Button></DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>New schedule block</DialogTitle></DialogHeader>
            <div className="space-y-3">
              <div><Label>Name</Label><Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Morning Drive" /></div>
              <div><Label>Station</Label>
                <Select value={form.station_id} onValueChange={(v) => setForm({ ...form, station_id: v })}>
                  <SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger>
                  <SelectContent>{stations?.map((s) => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div className="grid grid-cols-3 gap-3">
                <div><Label>Day</Label>
                  <Select value={form.day_of_week} onValueChange={(v) => setForm({ ...form, day_of_week: v })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>{DAYS.map(([k,l]) => <SelectItem key={k} value={k}>{l}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <div><Label>Start</Label><Input type="time" value={form.start_time} onChange={(e) => setForm({ ...form, start_time: e.target.value })} /></div>
                <div><Label>End</Label><Input type="time" value={form.end_time} onChange={(e) => setForm({ ...form, end_time: e.target.value })} /></div>
              </div>
              <div><Label>Playlist</Label>
                <Select value={form.playlist_id} onValueChange={(v) => setForm({ ...form, playlist_id: v })}>
                  <SelectTrigger><SelectValue placeholder="Optional" /></SelectTrigger>
                  <SelectContent>{playlists?.map((p) => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div><Label>Rotation rule</Label>
                <Select value={form.rotation_rule_id} onValueChange={(v) => setForm({ ...form, rotation_rule_id: v })}>
                  <SelectTrigger><SelectValue placeholder="Optional" /></SelectTrigger>
                  <SelectContent>{rules?.map((r) => <SelectItem key={r.id} value={r.id}>{r.name}</SelectItem>)}</SelectContent>
                </Select>
              </div>
            </div>
            <DialogFooter><Button onClick={() => create.mutate()} disabled={!form.name || !form.station_id}>Create</Button></DialogFooter>
          </DialogContent>
        </Dialog>
      )
    }>
      <div className="grid grid-cols-1 md:grid-cols-7 gap-3">
        {DAYS.map(([key, label]) => (
          <Card key={key} className="p-3">
            <div className="text-xs uppercase tracking-wider text-muted-foreground font-semibold mb-3">{label}</div>
            <div className="space-y-2 min-h-[120px]">
              {byDay[key]?.length ? byDay[key].map((b: any) => (
                <div key={b.id} className="rounded border border-border bg-secondary/40 p-2 text-xs group relative">
                  <div className="font-semibold">{b.name}</div>
                  <div className="text-muted-foreground tabular-nums">{b.start_time?.slice(0,5)}–{b.end_time?.slice(0,5)}</div>
                  {b.playlists?.name && <div className="text-muted-foreground mt-1">▸ {b.playlists.name}</div>}
                  {b.rotation_rules?.name && <div className="text-muted-foreground">⟳ {b.rotation_rules.name}</div>}
                  {isEditor && <button onClick={() => confirm("Delete block?") && del.mutate(b.id)} className="absolute top-1 right-1 opacity-0 group-hover:opacity-100 text-destructive"><Trash2 className="w-3 h-3" /></button>}
                </div>
              )) : <div className="text-xs text-muted-foreground italic">No blocks</div>}
            </div>
          </Card>
        ))}
      </div>
    </AppLayout>
  );
}
