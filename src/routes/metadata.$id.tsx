import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { database } from "@/services/database";
import { AppLayout } from "@/components/app-layout";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { StatusBadge } from "@/components/status-badge";
import { useEffect, useState } from "react";
import { useAuth } from "@/lib/auth";
import { toast } from "sonner";
import { ArrowLeft } from "lucide-react";

export const Route = createFileRoute("/metadata/$id")({ component: MetadataDetail });

const RIGHTS = ["unknown","cleared","ai_generated","local_permission","creative_commons","needs_review","blocked"] as const;

function MetadataDetail() {
  const { id } = Route.useParams();
  const qc = useQueryClient();
  const nav = useNavigate();
  const { isEditor } = useAuth();
  const [form, setForm] = useState<any>(null);

  const { data, isLoading } = useQuery({
    queryKey: ["track", id],
    queryFn: async () => {
      const { data: m } = await database.from("media_files").select("*, track_metadata(*), playlist_assignments(playlist_id, playlists(name)), stations(name)").eq("id", id).single();
      return m;
    },
  });

  useEffect(() => {
    if (data) {
      setForm(data.track_metadata ?? {
        media_file_id: id, artist: "", title: data.file_name, album: "", genre: "", mood: "", tempo: "", language: "",
        year: null, is_local_music: false, is_ai_generated: false, rights_status: "unknown", stim_status: "", explicit_content: false, notes: "",
      });
    }
  }, [data, id]);

  const save = useMutation({
    mutationFn: async () => {
      const payload = { ...form, year: form.year ? Number(form.year) : null };
      const { error } = await database.from("track_metadata").upsert(payload, { onConflict: "media_file_id" });
      if (error) throw error;
      // also flip media status if metadata now present
      if (form.artist && form.title) {
        await database.from("media_files").update({ status: data?.status === "missing_metadata" ? "ready" : data?.status }).eq("id", id);
      }
    },
    onSuccess: () => { toast.success("Saved"); qc.invalidateQueries({ queryKey: ["track", id] }); },
    onError: (e: any) => toast.error(e.message),
  });

  if (isLoading || !form) return <AppLayout title="Track Details"><div className="text-muted-foreground">Loading…</div></AppLayout>;

  return (
    <AppLayout title={form.title || data?.file_name || "Track"} description={`Station: ${data?.stations?.name ?? "—"}`} actions={
      <Button variant="outline" size="sm" onClick={() => nav({ to: "/metadata" })}><ArrowLeft className="w-4 h-4 mr-1" />Back</Button>
    }>
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <Card className="p-5 lg:col-span-2 space-y-4">
          <h3 className="font-semibold">Metadata</h3>
          <div className="grid grid-cols-2 gap-3">
            <div><Label>Artist</Label><Input disabled={!isEditor} value={form.artist ?? ""} onChange={(e) => setForm({ ...form, artist: e.target.value })} /></div>
            <div><Label>Title</Label><Input disabled={!isEditor} value={form.title ?? ""} onChange={(e) => setForm({ ...form, title: e.target.value })} /></div>
            <div><Label>Album</Label><Input disabled={!isEditor} value={form.album ?? ""} onChange={(e) => setForm({ ...form, album: e.target.value })} /></div>
            <div><Label>Genre</Label><Input disabled={!isEditor} value={form.genre ?? ""} onChange={(e) => setForm({ ...form, genre: e.target.value })} /></div>
            <div><Label>Mood</Label><Input disabled={!isEditor} value={form.mood ?? ""} onChange={(e) => setForm({ ...form, mood: e.target.value })} /></div>
            <div><Label>Tempo</Label><Input disabled={!isEditor} value={form.tempo ?? ""} onChange={(e) => setForm({ ...form, tempo: e.target.value })} /></div>
            <div><Label>Language</Label><Input disabled={!isEditor} value={form.language ?? ""} onChange={(e) => setForm({ ...form, language: e.target.value })} /></div>
            <div><Label>Year</Label><Input disabled={!isEditor} type="number" value={form.year ?? ""} onChange={(e) => setForm({ ...form, year: e.target.value })} /></div>
          </div>
          <div><Label>Notes</Label><Textarea disabled={!isEditor} value={form.notes ?? ""} onChange={(e) => setForm({ ...form, notes: e.target.value })} /></div>
          {isEditor && <Button onClick={() => save.mutate()} disabled={save.isPending}>Save changes</Button>}
        </Card>

        <div className="space-y-4">
          <Card className="p-5 space-y-4">
            <h3 className="font-semibold">Classification</h3>
            <div><Label>Rights status</Label>
              <Select value={form.rights_status} onValueChange={(v) => setForm({ ...form, rights_status: v })} disabled={!isEditor}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{RIGHTS.map((r) => <SelectItem key={r} value={r}>{r}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div><Label>STIM status</Label><Input disabled={!isEditor} value={form.stim_status ?? ""} onChange={(e) => setForm({ ...form, stim_status: e.target.value })} /></div>
            <div className="flex items-center justify-between"><Label>Local music</Label><Switch checked={form.is_local_music} disabled={!isEditor} onCheckedChange={(v) => setForm({ ...form, is_local_music: v })} /></div>
            <div className="flex items-center justify-between"><Label>AI-generated</Label><Switch checked={form.is_ai_generated} disabled={!isEditor} onCheckedChange={(v) => setForm({ ...form, is_ai_generated: v })} /></div>
            <div className="flex items-center justify-between"><Label>Explicit content</Label><Switch checked={form.explicit_content} disabled={!isEditor} onCheckedChange={(v) => setForm({ ...form, explicit_content: v })} /></div>
          </Card>
          <Card className="p-5">
            <h3 className="font-semibold mb-3">File</h3>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between"><span className="text-muted-foreground">File name</span><span className="font-mono text-xs">{data?.file_name}</span></div>
              <div className="flex justify-between"><span className="text-muted-foreground">Status</span><StatusBadge status={data?.status ?? "imported"} /></div>
              <div className="flex justify-between"><span className="text-muted-foreground">AzuraCast ID</span><span className="font-mono text-xs">{data?.azuracast_media_id ?? "—"}</span></div>
            </div>
          </Card>
          <Card className="p-5">
            <h3 className="font-semibold mb-3">Playlist assignments</h3>
            {data?.playlist_assignments?.length ? (
              <ul className="space-y-1 text-sm">{data.playlist_assignments.map((pa: any) => <li key={pa.playlist_id}>• {pa.playlists?.name}</li>)}</ul>
            ) : <p className="text-sm text-muted-foreground">Not in any playlist.</p>}
          </Card>
        </div>
      </div>
    </AppLayout>
  );
}
