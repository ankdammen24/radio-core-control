import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { AppLayout } from "@/components/app-layout";
import { Card } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Plus, RefreshCw, Trash2 } from "lucide-react";
import { useState } from "react";
import { useAuth } from "@/lib/auth";
import { toast } from "sonner";

export const Route = createFileRoute("/playlists")({ component: PlaylistsPage });

const TYPES = ["rotation","jingle","sweeper","promo","special","paused"] as const;

function PlaylistsPage() {
  const qc = useQueryClient();
  const { isEditor, isAdmin } = useAuth();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ name:"", description:"", playlist_type:"rotation", priority: 5, station_id: "", azuracast_playlist_id: "" });

  const { data: stations } = useQuery({ queryKey: ["stations-list"], queryFn: async () => (await supabase.from("stations").select("id,name")).data ?? [] });
  const { data, isLoading } = useQuery({
    queryKey: ["playlists"],
    queryFn: async () => (await supabase.from("playlists").select("*, stations(name), playlist_assignments(id)").order("priority", { ascending: false })).data ?? [],
  });

  const create = useMutation({
    mutationFn: async () => {
      const payload = { ...form, azuracast_playlist_id: form.azuracast_playlist_id || null };
      const { error } = await supabase.from("playlists").insert(payload as any);
      if (error) throw error;
    },
    onSuccess: () => { toast.success("Playlist created"); setOpen(false); qc.invalidateQueries({ queryKey:["playlists"] }); },
    onError: (e: any) => toast.error(e.message),
  });
  const toggle = useMutation({
    mutationFn: async ({ id, val }: { id: string; val: boolean }) => { const { error } = await supabase.from("playlists").update({ is_active: val }).eq("id", id); if (error) throw error; },
    onSuccess: () => qc.invalidateQueries({ queryKey:["playlists"] }),
  });
  const sync = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("sync_jobs").insert({ job_type: "playlist_sync", status: "pending", payload: { playlist_id: id } });
      if (error) throw error;
    },
    onSuccess: () => toast.success("Sync job queued"),
    onError: (e: any) => toast.error(e.message),
  });
  const del = useMutation({
    mutationFn: async (id: string) => { const { error } = await supabase.from("playlists").delete().eq("id", id); if (error) throw error; },
    onSuccess: () => { toast.success("Deleted"); qc.invalidateQueries({ queryKey:["playlists"] }); },
  });

  return (
    <AppLayout title="Playlists" description="Rotation, jingles, sweepers, promo and special playlists." actions={
      isEditor && (
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild><Button size="sm"><Plus className="w-4 h-4 mr-1" />New Playlist</Button></DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>New playlist</DialogTitle></DialogHeader>
            <div className="space-y-3">
              <div><Label>Name</Label><Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></div>
              <div><Label>Station</Label>
                <Select value={form.station_id} onValueChange={(v) => setForm({ ...form, station_id: v })}>
                  <SelectTrigger><SelectValue placeholder="Select station" /></SelectTrigger>
                  <SelectContent>{stations?.map((s) => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div><Label>Type</Label>
                  <Select value={form.playlist_type} onValueChange={(v) => setForm({ ...form, playlist_type: v })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>{TYPES.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <div><Label>Priority</Label><Input type="number" value={form.priority} onChange={(e) => setForm({ ...form, priority: Number(e.target.value) })} /></div>
              </div>
              <div><Label>AzuraCast Playlist ID</Label><Input value={form.azuracast_playlist_id} onChange={(e) => setForm({ ...form, azuracast_playlist_id: e.target.value })} /></div>
              <div><Label>Description</Label><Input value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} /></div>
            </div>
            <DialogFooter><Button onClick={() => create.mutate()} disabled={!form.name || !form.station_id || create.isPending}>Create</Button></DialogFooter>
          </DialogContent>
        </Dialog>
      )
    }>
      <Card className="overflow-hidden">
        <Table>
          <TableHeader><TableRow><TableHead>Name</TableHead><TableHead>Type</TableHead><TableHead>Station</TableHead><TableHead>Tracks</TableHead><TableHead>Priority</TableHead><TableHead>Active</TableHead><TableHead className="w-32" /></TableRow></TableHeader>
          <TableBody>
            {isLoading && <TableRow><TableCell colSpan={7} className="text-center text-muted-foreground py-8">Loading…</TableCell></TableRow>}
            {data?.map((p: any) => (
              <TableRow key={p.id}>
                <TableCell className="font-medium">{p.name}</TableCell>
                <TableCell><Badge variant="outline" className="uppercase text-[10px]">{p.playlist_type}</Badge></TableCell>
                <TableCell className="text-muted-foreground">{p.stations?.name}</TableCell>
                <TableCell>{p.playlist_assignments?.length ?? 0}</TableCell>
                <TableCell className="tabular-nums">{p.priority}</TableCell>
                <TableCell><Switch checked={p.is_active} disabled={!isEditor} onCheckedChange={(v) => toggle.mutate({ id: p.id, val: v })} /></TableCell>
                <TableCell className="text-right">
                  {isEditor && <Button variant="ghost" size="icon" title="Sync to AzuraCast" onClick={() => sync.mutate(p.id)}><RefreshCw className="w-4 h-4" /></Button>}
                  {isAdmin && <Button variant="ghost" size="icon" onClick={() => confirm(`Delete ${p.name}?`) && del.mutate(p.id)}><Trash2 className="w-4 h-4" /></Button>}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Card>
    </AppLayout>
  );
}
