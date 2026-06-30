import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  listPlaylists,
  createPlaylist,
  updatePlaylist,
  deletePlaylist,
  type ApiPlaylist,
} from "@/services/playlistsApi";
import { listStations } from "@/services/stationsApi";
import { ResourcePageShell } from "@/components/resource-page-shell";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { ConfirmDialog } from "@/components/confirm-dialog";
import { Plus, Trash2 } from "lucide-react";
import { useMemo, useState } from "react";
import { useAuth } from "@/lib/auth";
import { toast } from "sonner";

export const Route = createFileRoute("/playlists")({ component: PlaylistsPage });

const TYPES = ["rotation", "jingle", "sweeper", "promo", "special", "paused"] as const;

const EMPTY_FORM = {
  name: "",
  description: "",
  playlistType: "rotation",
  priority: 5,
  stationId: "",
  azuracastPlaylistId: "",
};

function PlaylistsPage() {
  const qc = useQueryClient();
  const { isEditor, isAdmin } = useAuth();
  const [open, setOpen] = useState(false);
  const [errs, setErrs] = useState<string | null>(null);
  const [q, setQ] = useState("");
  const [typeFilter, setTypeFilter] = useState<string>("all");
  const [form, setForm] = useState(EMPTY_FORM);

  const { data: stations } = useQuery({ queryKey: ["stations-list"], queryFn: listStations });
  const playlists = useQuery({ queryKey: ["playlists"], queryFn: listPlaylists });

  const filtered = useMemo(
    () =>
      (playlists.data ?? []).filter((p: ApiPlaylist) => {
        if (typeFilter !== "all" && p.playlistType !== typeFilter) return false;
        if (q && !`${p.name} ${p.description ?? ""}`.toLowerCase().includes(q.toLowerCase()))
          return false;
        return true;
      }),
    [playlists.data, q, typeFilter],
  );

  const create = useMutation({
    mutationFn: async () => {
      if (!form.name.trim()) {
        const m = "Name is required";
        setErrs(m);
        throw new Error(m);
      }
      setErrs(null);
      await createPlaylist({
        name: form.name.trim(),
        description: form.description || undefined,
        stationId: form.stationId || undefined,
        playlistType: form.playlistType,
        priority: form.priority,
        azuracastPlaylistId: form.azuracastPlaylistId || undefined,
      });
    },
    onSuccess: () => {
      toast.success("Playlist created");
      setOpen(false);
      setForm(EMPTY_FORM);
      qc.invalidateQueries({ queryKey: ["playlists"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const toggle = useMutation({
    mutationFn: ({ id, active }: { id: string; active: boolean }) =>
      updatePlaylist(id, { isActive: active }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["playlists"] }),
    onError: (e: Error) => toast.error(e.message),
  });

  const del = useMutation({
    mutationFn: (id: string) => deletePlaylist(id),
    onSuccess: () => {
      toast.success("Deleted");
      qc.invalidateQueries({ queryKey: ["playlists"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const state = playlists.isLoading
    ? { kind: "loading" as const }
    : playlists.error
      ? {
          kind: "error" as const,
          message: (playlists.error as Error).message,
          retry: () => playlists.refetch(),
        }
      : filtered.length === 0
        ? {
            kind: "empty" as const,
            title: "Inga spellistor ännu",
            hint: "Skapa en spellista för att komma igång.",
          }
        : { kind: "ready" as const };

  const primaryAction = isEditor && (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm">
          <Plus className="w-4 h-4 mr-1" />
          New Playlist
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>New playlist</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div>
            <Label>Name *</Label>
            <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
          </div>
          <div>
            <Label>Station</Label>
            <Select
              value={form.stationId}
              onValueChange={(v) => setForm({ ...form, stationId: v })}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select station (optional)" />
              </SelectTrigger>
              <SelectContent>
                {stations?.map((s) => (
                  <SelectItem key={s.id} value={s.id}>
                    {s.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Type</Label>
              <Select
                value={form.playlistType}
                onValueChange={(v) => setForm({ ...form, playlistType: v })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {TYPES.map((t) => (
                    <SelectItem key={t} value={t}>
                      {t}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Priority</Label>
              <Input
                type="number"
                value={form.priority}
                onChange={(e) => setForm({ ...form, priority: Number(e.target.value) })}
              />
            </div>
          </div>
          <div>
            <Label>AzuraCast Playlist ID</Label>
            <Input
              value={form.azuracastPlaylistId}
              onChange={(e) => setForm({ ...form, azuracastPlaylistId: e.target.value })}
            />
          </div>
          <div>
            <Label>Description</Label>
            <Input
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
            />
          </div>
          {errs && <p className="text-xs text-destructive">{errs}</p>}
        </div>
        <DialogFooter>
          <Button onClick={() => create.mutate()} disabled={create.isPending}>
            {create.isPending ? "Creating…" : "Create"}
          </Button>
        </DialogFooter>
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
          <SelectTrigger className="h-9 w-36">
            <SelectValue placeholder="Type" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All types</SelectItem>
            {TYPES.map((t) => (
              <SelectItem key={t} value={t}>
                {t}
              </SelectItem>
            ))}
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
            <TableHead>Priority</TableHead>
            <TableHead>AzuraCast</TableHead>
            <TableHead>Active</TableHead>
            <TableHead className="w-12" />
          </TableRow>
        </TableHeader>
        <TableBody>
          {filtered.map((p) => (
            <TableRow key={p.id}>
              <TableCell className="font-medium">{p.name}</TableCell>
              <TableCell>
                <Badge variant="outline" className="uppercase text-[10px]">
                  {p.playlistType}
                </Badge>
              </TableCell>
              <TableCell className="text-muted-foreground">
                {stations?.find((s) => s.id === p.stationId)?.name ?? "—"}
              </TableCell>
              <TableCell className="tabular-nums">{p.priority}</TableCell>
              <TableCell className="text-xs text-muted-foreground">
                {p.azuracastPlaylistId ? "synced" : "—"}
              </TableCell>
              <TableCell>
                <Switch
                  checked={p.isActive}
                  disabled={!isEditor}
                  onCheckedChange={(v) => toggle.mutate({ id: p.id, active: v })}
                />
              </TableCell>
              <TableCell>
                {isAdmin && (
                  <ConfirmDialog
                    title={`Delete "${p.name}"?`}
                    confirmText="Delete"
                    destructive
                    onConfirm={() => del.mutateAsync(p.id)}
                    trigger={
                      <Button variant="ghost" size="icon">
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    }
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
