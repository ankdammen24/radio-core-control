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
import { ConfirmDialog } from "@/components/confirm-dialog";
import { Plus, Trash2 } from "lucide-react";
import { useMemo, useState } from "react";
import { useAuth } from "@/lib/auth";
import { toast } from "sonner";

export const Route = createFileRoute("/playlists")({ component: PlaylistsPage });

const EMPTY_FORM = { name: "", description: "", stationId: "" };

function PlaylistsPage() {
  const qc = useQueryClient();
  const { isEditor, isAdmin } = useAuth();
  const [open, setOpen] = useState(false);
  const [errs, setErrs] = useState<string | null>(null);
  const [q, setQ] = useState("");
  const [form, setForm] = useState(EMPTY_FORM);

  const { data: stations } = useQuery({ queryKey: ["stations-list"], queryFn: listStations });
  const playlists = useQuery({ queryKey: ["playlists"], queryFn: listPlaylists });

  const filtered = useMemo(
    () =>
      (playlists.data ?? []).filter((p: ApiPlaylist) => {
        if (q && !`${p.name} ${p.description ?? ""}`.toLowerCase().includes(q.toLowerCase()))
          return false;
        return true;
      }),
    [playlists.data, q],
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
      updatePlaylist(id, { status: active ? "active" : "inactive" }),
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
                  <SelectItem key={s._id} value={s._id}>
                    {s.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
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
      description="Playlists of media files."
      primaryAction={primaryAction}
      searchValue={q}
      onSearchChange={setQ}
      searchPlaceholder="Search playlists…"
      state={state}
    >
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Name</TableHead>
            <TableHead>Station</TableHead>
            <TableHead>Items</TableHead>
            <TableHead>Active</TableHead>
            <TableHead className="w-12" />
          </TableRow>
        </TableHeader>
        <TableBody>
          {filtered.map((p) => (
            <TableRow key={p._id}>
              <TableCell className="font-medium">{p.name}</TableCell>
              <TableCell className="text-muted-foreground">
                {stations?.find((s) => s._id === p.stationId)?.name ?? "—"}
              </TableCell>
              <TableCell className="tabular-nums">{p.items.length}</TableCell>
              <TableCell>
                <Switch
                  checked={p.status === "active"}
                  disabled={!isEditor}
                  onCheckedChange={(v) => toggle.mutate({ id: p._id, active: v })}
                />
              </TableCell>
              <TableCell>
                {isAdmin && (
                  <ConfirmDialog
                    title={`Delete "${p.name}"?`}
                    confirmText="Delete"
                    destructive
                    onConfirm={() => del.mutateAsync(p._id)}
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
