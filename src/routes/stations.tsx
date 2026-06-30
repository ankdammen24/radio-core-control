import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  listStations,
  createStation,
  updateStation,
  deleteStation,
  type ApiStation,
} from "@/services/stationsApi";
import { AppLayout } from "@/components/app-layout";
import { Card } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { ConfirmDialog } from "@/components/confirm-dialog";
import { EmptyState, ErrorState, LoadingRows } from "@/components/data-states";
import { Plus, Trash2, Radio } from "lucide-react";
import { useState } from "react";
import { useAuth } from "@/lib/auth";
import { toast } from "sonner";

export const Route = createFileRoute("/stations")({ component: StationsPage });

const EMPTY_FORM = {
  name: "",
  slug: "",
  description: "",
  logoUrl: "",
  streamUrl: "",
  timezone: "",
};

function StationsPage() {
  const qc = useQueryClient();
  const { isEditor, isAdmin } = useAuth();
  const [open, setOpen] = useState(false);
  const [errs, setErrs] = useState<string | null>(null);
  const [form, setForm] = useState(EMPTY_FORM);

  const stations = useQuery({
    queryKey: ["stations"],
    queryFn: listStations,
  });

  const create = useMutation({
    mutationFn: async () => {
      if (!form.name.trim() || !form.slug.trim()) {
        const m = "Name and slug are required";
        setErrs(m);
        throw new Error(m);
      }
      setErrs(null);
      await createStation({
        name: form.name.trim(),
        slug: form.slug.trim(),
        description: form.description || undefined,
        logoUrl: form.logoUrl || undefined,
        streamUrl: form.streamUrl || undefined,
        timezone: form.timezone || undefined,
      });
    },
    onSuccess: () => {
      toast.success("Station created");
      setOpen(false);
      setForm(EMPTY_FORM);
      qc.invalidateQueries({ queryKey: ["stations"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const toggle = useMutation({
    mutationFn: ({ id, active }: { id: string; active: boolean }) =>
      updateStation(id, { status: active ? "active" : "inactive" }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["stations"] }),
    onError: (e: Error) => toast.error(e.message),
  });

  const del = useMutation({
    mutationFn: (id: string) => deleteStation(id),
    onSuccess: () => {
      toast.success("Deleted");
      qc.invalidateQueries({ queryKey: ["stations"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <AppLayout
      title="Stations"
      description="Radio stations served by Radio Core."
      actions={
        isEditor && (
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button size="sm">
                <Plus className="w-4 h-4 mr-1" />
                New Station
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>New station</DialogTitle>
              </DialogHeader>
              <div className="space-y-3">
                <div>
                  <Label>Name *</Label>
                  <Input
                    value={form.name}
                    onChange={(e) => setForm({ ...form, name: e.target.value })}
                  />
                </div>
                <div>
                  <Label>Slug *</Label>
                  <Input
                    value={form.slug}
                    onChange={(e) =>
                      setForm({ ...form, slug: e.target.value.toLowerCase().replace(/\s+/g, "-") })
                    }
                  />
                </div>
                <div>
                  <Label>Stream URL</Label>
                  <Input
                    value={form.streamUrl}
                    onChange={(e) => setForm({ ...form, streamUrl: e.target.value })}
                  />
                </div>
                <div>
                  <Label>Logo URL</Label>
                  <Input
                    value={form.logoUrl}
                    onChange={(e) => setForm({ ...form, logoUrl: e.target.value })}
                  />
                </div>
                <div>
                  <Label>Timezone</Label>
                  <Input
                    placeholder="Europe/Stockholm"
                    value={form.timezone}
                    onChange={(e) => setForm({ ...form, timezone: e.target.value })}
                  />
                </div>
                <div>
                  <Label>Description</Label>
                  <Textarea
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
        )
      }
    >
      {stations.error && <ErrorState error={stations.error} onRetry={() => stations.refetch()} />}
      {!stations.error && (
        <Card className="overflow-hidden">
          {stations.isLoading ? (
            <LoadingRows cols={5} />
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Slug</TableHead>
                  <TableHead>Stream URL</TableHead>
                  <TableHead>Active</TableHead>
                  <TableHead className="w-12" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {stations.data?.map((s: ApiStation) => (
                  <TableRow key={s._id}>
                    <TableCell className="font-medium">{s.name}</TableCell>
                    <TableCell className="text-muted-foreground font-mono text-xs">
                      {s.slug}
                    </TableCell>
                    <TableCell className="text-muted-foreground font-mono text-xs">
                      {s.streamUrl ?? "—"}
                    </TableCell>
                    <TableCell>
                      <Switch
                        checked={s.status === "active"}
                        disabled={!isEditor}
                        onCheckedChange={(v) => toggle.mutate({ id: s._id, active: v })}
                      />
                    </TableCell>
                    <TableCell>
                      {isAdmin && (
                        <ConfirmDialog
                          title={`Delete station "${s.name}"?`}
                          description="This removes the station from Radio Core."
                          confirmText="Delete"
                          destructive
                          onConfirm={() => del.mutateAsync(s._id)}
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
          )}
          {!stations.isLoading && !stations.data?.length && (
            <div className="p-6">
              <EmptyState
                icon={Radio}
                title="Inga stationer ännu"
                description="Skapa en station för att komma igång."
              />
            </div>
          )}
        </Card>
      )}
    </AppLayout>
  );
}
