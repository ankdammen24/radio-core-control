import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { database } from "@/services/database";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { StatusBadge } from "@/components/status-badge";
import { ConfirmDialog } from "@/components/confirm-dialog";
import { EmptyState, ErrorState, LoadingRows } from "@/components/data-states";
import { Plus, Trash2, Radio, Key, Copy } from "lucide-react";
import { useState } from "react";
import { useAuth } from "@/lib/auth";
import { toast } from "sonner";
import { stationSchema, formatZodError } from "@/lib/validation";
import { useServerFn } from "@tanstack/react-start";
import { generateStationApiKey } from "@/lib/news.functions";

export const Route = createFileRoute("/stations")({ component: StationsPage });

function StationsPage() {
  const qc = useQueryClient();
  const { isEditor, isAdmin } = useAuth();
  const [open, setOpen] = useState(false);
  const [errs, setErrs] = useState<string | null>(null);
  const [form, setForm] = useState({
    name: "",
    slug: "",
    description: "",
    account_id: "",
    azuracast_station_id: "",
    is_active: true,
  });

  const { data: accounts } = useQuery({
    queryKey: ["accounts-list"],
    queryFn: async () =>
      (await database.from("accounts").select("id,name").order("name")).data ?? [],
  });
  const stations = useQuery({
    queryKey: ["stations"],
    queryFn: async () => {
      const { data, error } = await database
        .from("stations")
        .select("*, accounts(name)")
        .order("name");
      if (error) throw error;
      return data ?? [];
    },
  });

  const create = useMutation({
    mutationFn: async () => {
      const parsed = stationSchema.safeParse(form);
      if (!parsed.success) {
        const m = formatZodError(parsed.error);
        setErrs(m);
        throw new Error(m);
      }
      setErrs(null);
      const payload = {
        ...parsed.data,
        is_active: true,
        account_id: form.account_id || null,
        azuracast_station_id: form.azuracast_station_id || null,
      };
      const { error } = await database.from("stations").insert(payload as any);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Station created");
      setOpen(false);
      setForm({
        name: "",
        slug: "",
        description: "",
        account_id: "",
        azuracast_station_id: "",
        is_active: true,
      });
      qc.invalidateQueries({ queryKey: ["stations"] });
    },
    onError: (e: any) => toast.error(e.message),
  });
  const toggle = useMutation({
    mutationFn: async ({ id, val }: { id: string; val: boolean }) => {
      const { error } = await database.from("stations").update({ is_active: val }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["stations"] }),
    onError: (e: any) => toast.error(e.message),
  });
  const del = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await database.from("stations").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Deleted");
      qc.invalidateQueries({ queryKey: ["stations"] });
    },
    onError: (e: any) => toast.error(e.message),
  });

  return (
    <AppLayout
      title="Stations"
      description="Broadcast stations linked to AzuraCast."
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
                  <Label>Account</Label>
                  <Select
                    value={form.account_id}
                    onValueChange={(v) => setForm({ ...form, account_id: v })}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select account" />
                    </SelectTrigger>
                    <SelectContent>
                      {accounts?.map((a) => (
                        <SelectItem key={a.id} value={a.id}>
                          {a.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>AzuraCast Station ID</Label>
                  <Input
                    value={form.azuracast_station_id}
                    onChange={(e) => setForm({ ...form, azuracast_station_id: e.target.value })}
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
            <LoadingRows cols={7} />
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Slug</TableHead>
                  <TableHead>Account</TableHead>
                  <TableHead>AzuraCast ID</TableHead>
                  <TableHead>API Key</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Active</TableHead>
                  <TableHead className="w-12" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {stations.data?.map((s: any) => (
                  <TableRow key={s.id}>
                    <TableCell className="font-medium">{s.name}</TableCell>
                    <TableCell className="text-muted-foreground font-mono text-xs">
                      {s.slug}
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {s.accounts?.name ?? "—"}
                    </TableCell>
                    <TableCell className="text-muted-foreground font-mono text-xs">
                      {s.azuracast_station_id ?? "—"}
                    </TableCell>
                    <TableCell>
                      {isAdmin ? (
                        <StationApiKeyButton stationId={s.id} hasKey={!!s.api_key_hash} />
                      ) : s.api_key_hash ? (
                        <span className="text-xs text-emerald-400">set</span>
                      ) : (
                        <span className="text-xs text-muted-foreground">none</span>
                      )}
                    </TableCell>
                    <TableCell>
                      <StatusBadge status={s.azuracast_station_id ? "ok" : "untested"} />
                    </TableCell>
                    <TableCell>
                      <Switch
                        checked={s.is_active}
                        disabled={!isEditor}
                        onCheckedChange={(v) => toggle.mutate({ id: s.id, val: v })}
                      />
                    </TableCell>
                    <TableCell>
                      {isAdmin && (
                        <ConfirmDialog
                          title={`Delete station "${s.name}"?`}
                          description="This removes the station from Radio Core. AzuraCast data is not deleted."
                          confirmText="Delete"
                          destructive
                          onConfirm={() => del.mutateAsync(s.id)}
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
                description="Kör den frivilliga bootstrapen eller skapa en station när en skrivbar backend är ansluten."
              />
            </div>
          )}
        </Card>
      )}
    </AppLayout>
  );
}

function StationApiKeyButton({ stationId, hasKey }: { stationId: string; hasKey: boolean }) {
  const gen = useServerFn(generateStationApiKey);
  const [issued, setIssued] = useState<string | null>(null);
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);

  async function generate() {
    setBusy(true);
    try {
      const r = await gen({ data: { stationId } });
      setIssued(r.plaintext);
      setOpen(true);
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <Button size="sm" variant={hasKey ? "ghost" : "outline"} onClick={generate} disabled={busy}>
        <Key className="w-3.5 h-3.5 mr-1" />
        {hasKey ? "Rotate" : "Generate"}
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>API key issued</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            Copy this key now — it will not be shown again. Use it as{" "}
            <code className="font-mono">Authorization: Bearer &lt;key&gt;</code> when calling{" "}
            <code className="font-mono">/api/public/radio/news</code>.
          </p>
          <div className="flex gap-2 items-center bg-muted/40 p-2 rounded font-mono text-xs break-all">
            <span className="flex-1">{issued}</span>
            <Button
              size="sm"
              variant="ghost"
              onClick={() => {
                if (issued) {
                  navigator.clipboard.writeText(issued);
                  toast.success("Copied");
                }
              }}
            >
              <Copy className="w-3.5 h-3.5" />
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
