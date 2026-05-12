import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { ResourcePageShell } from "@/components/resource-page-shell";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { ConfirmDialog } from "@/components/confirm-dialog";
import { SyncStatusBadge, type SyncStatus } from "@/components/sync-status-badge";
import { Plus, RefreshCw, Trash2 } from "lucide-react";
import { useMemo, useState } from "react";
import { useAuth } from "@/lib/auth";
import { useStationScope } from "@/lib/station-context";
import { toast } from "sonner";
import { playlistSchema, formatZodError } from "@/lib/validation";
import { logAudit } from "@/lib/audit";

export const Route = createFileRoute("/playlists")({ component: PlaylistsPage });

const TYPES = ["rotation","jingle","sweeper","promo","special","paused"] as const;

function derivePlaylistSync(p: { azuracast_playlist_id?: string | null; sync_dirty?: boolean | null }): SyncStatus {
  if (p.sync_dirty) return "dirty";
  if (p.azuracast_playlist_id) return "synced";
  return "local_only";
}

function PlaylistsPage() {
  const qc = useQueryClient();
  const { isEditor, isAdmin } = useAuth();
  const { scope } = useStationScope();
  const [open, setOpen] = useState(false);
  const [errs, setErrs] = useState<string | null>(null);
  const [q, setQ] = useState("");
  const [typeFilter, setTypeFilter] = useState<string>("all");
  const [form, setForm] = useState({ name:"", description:"", playlist_type:"rotation", priority: 5, station_id: "", azuracast_playlist_id: "" });

  const { data: stations } = useQuery({ queryKey: ["stations-list"], queryFn: async () => (await supabase.from("stations").select("id,name")).data ?? [] });
  const playlists = useQuery({
    queryKey: ["playlists"],
    queryFn: async () => {
      const { data, error } = await supabase.from("playlists").select("*, stations(name), playlist_assignments(id)").order("priority", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });

  const filtered = useMemo(() => (playlists.data ?? []).filter((p: any) => {
    if (scope.kind === "station" && p.station_id !== scope.station.id) return false;
    if (typeFilter !== "all" && p.playlist_type !== typeFilter) return false;
    if (q && !`${p.name} ${p.description ?? ""}`.toLowerCase().includes(q.toLowerCase())) return false;
    return true;
  }), [playlists.data, q, typeFilter, scope]);

  const create = useMutation({
    mutationFn: async () => {
      const parsed = playlistSchema.safeParse(form);
      if (!parsed.success) { const m = formatZodError(parsed.error); setErrs(m); throw new Error(m); }
      setErrs(null);
      const payload = { ...parsed.data, azuracast_playlist_id: form.azuracast_playlist_id || null };
      const { error } = await supabase.from("playlists").insert(payload as any);
      if (error) throw error;
    },
    onSuccess: () => { toast.success("Playlist created"); setOpen(false); setForm({ name:"", description:"", playlist_type:"rotation", priority: 5, station_id: "", azuracast_playlist_id: "" }); qc.invalidateQueries({ queryKey:["playlists"] }); },
    onError: (e: any) => toast.error(e.message),
  });
  const toggle = useMutation({
    mutationFn: async ({ id, val }: { id: string; val: boolean }) => { const { error } = await supabase.from("playlists").update({ is_active: val }).eq("id", id); if (error) throw error; },
    onSuccess: () => qc.invalidateQueries({ queryKey:["playlists"] }),
  });
  const sync = useMutation({
    mutationFn: async (p: any) => {
      const { error } = await supabase.from("sync_jobs").insert({ station_id: p.station_id, job_type: "playlist_sync", status: "pending", payload: { playlist_id: p.id } });
      if (error) throw error;
      await logAudit("sync.queue.playlist", "playlists", p.id);
    },
    onSuccess: () => toast.success("Sync job queued"),
    onError: (e: any) => toast.error(e.message),
  });
  const del = useMutation({
    mutationFn: async (id: string) => { const { error } = await supabase.from("playlists").delete().eq("id", id); if (error) throw error; },
    onSuccess: () => { toast.success("Deleted"); qc.invalidateQueries({ queryKey:["playlists"] }); },
    onError: (e: any) => toast.error(e.message),
  });

  const state =
    playlists.isLoading ? { kind: "loading" as const } :
    playlists.error ? { kind: "error" as const, message: (playlists.error as Error).message, retry: () => playlists.refetch() } :
    filtered.length === 0 ? { kind: "empty" as const, title: "No playlists", hint: "Create rotation, jingle, sweeper, promo or special playlists." } :
    { kind: "ready" as const };

  const primaryAction = isEditor && (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild><Button size="sm"><Plus className="w-4 h-4 mr-1" />New Playlist</Button></DialogTrigger>
      <DialogContent>
        <DialogHeader><DialogTitle>New playlist</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <div><Label>Name *</Label><Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></div>
          <div><Label>Station *</Label>
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
          {errs && <p className="text-xs text-destructive">{errs}</p>}
        </div>
        <DialogFooter><Button onClick={() => create.mutate()} disabled={create.isPending}>{create.isPending ? "Creating…" : "Create"}</Button></DialogFooter>
      </DialogContent>
    </Dialog>
  );

  return (
    <ResourcePageShell
      title="Playlists"
      description="Rotation, jingles, sweepers, promo and special playlists."
      primaryAction={primaryAction}
      searchValue={q}
      onSearchChange={setQ}
      searchPlaceholder="Search playlists…"
      filters={
        <Select value={typeFilter} onValueChange={setTypeFilter}>
          <SelectTrigger className="h-9 w-36"><SelectValue placeholder="Type" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All types</SelectItem>
            {TYPES.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}
          </SelectContent>
        </Select>
      }
      state={state}
    >
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Name</TableHead>
            <TableHead>Type</TableHead>
            <TableHead>Station</TableHead>
            <TableHead>Tracks</TableHead>
            <TableHead>Priority</TableHead>
            <TableHead>Sync</TableHead>
            <TableHead>Active</TableHead>
            <TableHead className="w-32" />
          </TableRow>
        </TableHeader>
        <TableBody>
          {filtered.map((p: any) => (
            <TableRow key={p.id}>
              <TableCell className="font-medium">{p.name}</TableCell>
              <TableCell><Badge variant="outline" className="uppercase text-[10px]">{p.playlist_type}</Badge></TableCell>
              <TableCell className="text-muted-foreground">{p.stations?.name}</TableCell>
              <TableCell className="tabular-nums">{p.playlist_assignments?.length ?? 0}</TableCell>
              <TableCell className="tabular-nums">{p.priority}</TableCell>
              <TableCell><SyncStatusBadge status={derivePlaylistSync(p)} compact /></TableCell>
              <TableCell><Switch checked={p.is_active} disabled={!isEditor} onCheckedChange={(v) => toggle.mutate({ id: p.id, val: v })} /></TableCell>
              <TableCell className="text-right">
                {isEditor && (
                  <ConfirmDialog
                    title={`Sync "${p.name}"?`}
                    description="This queues a background job to push playlist tracks to the runtime."
                    confirmText="Queue sync"
                    onConfirm={() => sync.mutateAsync(p)}
                    trigger={<Button variant="ghost" size="icon" title="Queue sync"><RefreshCw className="w-4 h-4" /></Button>}
                  />
                )}
                {isAdmin && (
                  <ConfirmDialog
                    title={`Delete "${p.name}"?`}
                    description="Schedule blocks referencing this playlist will lose the link."
                    confirmText="Delete" destructive
                    onConfirm={() => del.mutateAsync(p.id)}
                    trigger={<Button variant="ghost" size="icon"><Trash2 className="w-4 h-4" /></Button>}
                  />
                )}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </ResourcePageShell>
  );
}
