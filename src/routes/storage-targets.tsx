import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { database } from "@/services/database";
import { ResourcePageShell } from "@/components/resource-page-shell";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ConfirmDialog } from "@/components/confirm-dialog";
import { useStationScope } from "@/lib/station-context";
import { useAuth } from "@/lib/auth";
import { toast } from "sonner";
import { Plus, Cloud, Activity, Trash2, Pencil, HardDrive, Server, Globe2, Database } from "lucide-react";
import {
  upsertStorageTarget, deleteStorageTarget, testStorageTarget,
} from "@/lib/storage-targets.functions";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/storage-targets")({ component: StorageTargetsPage });

const PROVIDERS = [
  { value: "r2",            label: "Cloudflare R2",  icon: Cloud },
  { value: "s3",            label: "Generic S3",     icon: Database },
  { value: "azure_blob",    label: "Azure Blob",     icon: Cloud },
  { value: "local",         label: "Local mount",    icon: Server },
  { value: "external_url",  label: "External URL",   icon: Globe2 },
] as const;

const PURPOSES = [
  { value: "media",   label: "Media" },
  { value: "artwork", label: "Artwork" },
  { value: "cdn",     label: "CDN" },
  { value: "backup",  label: "Backup" },
  { value: "exports", label: "Exports" },
] as const;

type Provider = typeof PROVIDERS[number]["value"];
type Purpose  = typeof PURPOSES[number]["value"];

type FormState = {
  id?: string;
  station_id: string;
  name: string;
  provider: Provider;
  purpose: Purpose;
  bucket: string;
  endpoint_url: string;
  region: string;
  public_base_url: string;
  access_key_ref: string;
  secret_key_ref: string;
  is_active: boolean;
};

const EMPTY_FORM = (station_id = ""): FormState => ({
  station_id, name: "", provider: "r2", purpose: "media",
  bucket: "", endpoint_url: "", region: "auto", public_base_url: "",
  access_key_ref: "S3_ACCESS_KEY_ID", secret_key_ref: "S3_SECRET_ACCESS_KEY",
  is_active: true,
});

function statusClass(s: string | null | undefined) {
  switch (s) {
    case "online":  return "bg-success/15 text-success border-success/30";
    case "warning": return "bg-warning/15 text-warning border-warning/30";
    case "offline": return "bg-destructive/15 text-destructive border-destructive/30";
    default:        return "bg-muted text-muted-foreground border-border";
  }
}

function purposeClass(p: string) {
  switch (p) {
    case "media":   return "bg-primary/10 text-primary border-primary/30";
    case "artwork": return "bg-accent/15 text-accent-foreground border-accent/30";
    case "cdn":     return "bg-info/15 text-info border-info/30";
    case "backup":  return "bg-warning/10 text-warning border-warning/30";
    case "exports": return "bg-muted text-muted-foreground border-border";
    default:        return "bg-muted text-muted-foreground border-border";
  }
}

function providerMeta(p: string) {
  return PROVIDERS.find((x) => x.value === p) ?? { label: p, icon: HardDrive };
}

function StorageTargetsPage() {
  const qc = useQueryClient();
  const { isAdmin, isEditor } = useAuth();
  const { scope } = useStationScope();
  const [q, setQ] = useState("");
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<FormState>(EMPTY_FORM());

  const stations = useQuery({
    queryKey: ["stations-list"],
    queryFn: async () => (await database.from("stations").select("id,name").order("name")).data ?? [],
  });

  const targets = useQuery({
    queryKey: ["storage-targets"],
    queryFn: async () => {
      const { data, error } = await database
        .from("storage_targets")
        .select("*, stations(name)")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });

  const visible = useMemo(() => {
    let rows = targets.data ?? [];
    if (scope.kind === "station") rows = rows.filter((r: any) => r.station_id === scope.station.id);
    if (q.trim()) {
      const needle = q.toLowerCase();
      rows = rows.filter((r: any) =>
        r.name.toLowerCase().includes(needle) ||
        r.provider.toLowerCase().includes(needle) ||
        (r.bucket ?? "").toLowerCase().includes(needle) ||
        (r.public_base_url ?? "").toLowerCase().includes(needle));
    }
    return rows;
  }, [targets.data, scope, q]);

  const upsertFn = useServerFn(upsertStorageTarget);
  const deleteFn = useServerFn(deleteStorageTarget);
  const testFn   = useServerFn(testStorageTarget);

  const save = useMutation({
    mutationFn: async () => {
      if (!form.station_id) throw new Error("Station is required");
      if (!form.name.trim()) throw new Error("Name is required");
      return upsertFn({ data: {
        id: form.id,
        station_id: form.station_id,
        name: form.name.trim(),
        provider: form.provider,
        purpose: form.purpose,
        bucket: form.bucket || null,
        endpoint_url: form.endpoint_url || null,
        region: form.region || null,
        public_base_url: form.public_base_url || null,
        access_key_ref: form.access_key_ref || null,
        secret_key_ref: form.secret_key_ref || null,
        is_active: form.is_active,
      }});
    },
    onSuccess: () => {
      toast.success(form.id ? "Storage target updated" : "Storage target created");
      setOpen(false);
      setForm(EMPTY_FORM(scope.kind === "station" ? scope.station.id : ""));
      qc.invalidateQueries({ queryKey: ["storage-targets"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const test = useMutation({
    mutationFn: async (id: string) => testFn({ data: { id } }),
    onSuccess: (r) => {
      if (r.ok) toast.success(`Online (${r.duration_ms}ms): ${r.message}`);
      else toast.error(`${r.status} (${r.duration_ms}ms): ${r.message}`);
      qc.invalidateQueries({ queryKey: ["storage-targets"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const openCreate = () => {
    setForm(EMPTY_FORM(scope.kind === "station" ? scope.station.id : ""));
    setOpen(true);
  };
  const openEdit = (t: any) => {
    setForm({
      id: t.id, station_id: t.station_id, name: t.name,
      provider: t.provider, purpose: t.purpose,
      bucket: t.bucket ?? "", endpoint_url: t.endpoint_url ?? "",
      region: t.region ?? "", public_base_url: t.public_base_url ?? "",
      access_key_ref: t.access_key_ref ?? "", secret_key_ref: t.secret_key_ref ?? "",
      is_active: t.is_active,
    });
    setOpen(true);
  };

  const state =
    targets.isLoading ? { kind: "loading" as const } :
    targets.error    ? { kind: "error" as const, message: (targets.error as Error).message, retry: () => targets.refetch() } :
    visible.length === 0 ? {
      kind: "empty" as const,
      title: "No storage targets",
      hint: "Register a Cloudflare R2 bucket, S3 bucket, or external URL to wire up media, artwork, CDN, backup or exports storage.",
      action: isEditor ? <Button onClick={openCreate}><Plus className="w-4 h-4 mr-1" />New target</Button> : undefined,
    } :
    { kind: "ready" as const };

  const requiresCreds = (p: Provider) => p === "r2" || p === "s3" || p === "azure_blob";

  return (
    <ResourcePageShell
      title="Storage Targets"
      description="Object storage and CDN endpoints managed by this control plane."
      searchValue={q} onSearchChange={setQ}
      searchPlaceholder="Search targets…"
      primaryAction={isEditor ? (
        <Button size="sm" onClick={openCreate}><Plus className="w-4 h-4 mr-1" />New target</Button>
      ) : undefined}
      state={state}
    >
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Name</TableHead>
            <TableHead>Provider</TableHead>
            <TableHead>Purpose</TableHead>
            <TableHead>Status</TableHead>
            <TableHead>Bucket / URL</TableHead>
            <TableHead>Last checked</TableHead>
            <TableHead className="text-right">Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {visible.map((t: any) => {
            const meta = providerMeta(t.provider);
            const ProvIcon = meta.icon;
            const credsMissing = requiresCreds(t.provider) && (!t.access_key_ref || !t.secret_key_ref || !t.bucket);
            return (
              <TableRow key={t.id}>
                <TableCell className="font-medium">
                  <div className="flex items-center gap-2"><HardDrive className="w-3.5 h-3.5 text-muted-foreground" />{t.name}</div>
                  <div className="text-[11px] text-muted-foreground">{t.stations?.name ?? "—"}</div>
                  {credsMissing && (
                    <div className="text-[11px] text-warning mt-1">⚠ Missing bucket or credential refs</div>
                  )}
                  {t.last_error && t.status !== "online" && (
                    <div className="text-[11px] text-destructive truncate max-w-[260px]" title={t.last_error}>{t.last_error}</div>
                  )}
                </TableCell>
                <TableCell>
                  <Badge variant="outline" className="text-[10px] uppercase gap-1">
                    <ProvIcon className="w-3 h-3" />{meta.label}
                  </Badge>
                </TableCell>
                <TableCell>
                  <Badge variant="outline" className={cn("text-[10px] uppercase", purposeClass(t.purpose))}>{t.purpose}</Badge>
                </TableCell>
                <TableCell>
                  <Badge variant="outline" className={cn("text-[10px] uppercase", statusClass(t.status))}>{t.status}</Badge>
                </TableCell>
                <TableCell className="text-xs font-mono">
                  <div className="truncate max-w-[240px]" title={t.bucket ?? ""}>{t.bucket ?? "—"}</div>
                  {t.public_base_url && (
                    <a href={t.public_base_url} target="_blank" rel="noreferrer"
                       className="text-[11px] text-primary truncate max-w-[240px] block hover:underline">
                      {t.public_base_url}
                    </a>
                  )}
                </TableCell>
                <TableCell className="text-xs text-muted-foreground">
                  {t.last_checked_at ? new Date(t.last_checked_at).toLocaleString() : "—"}
                </TableCell>
                <TableCell className="text-right">
                  <div className="flex justify-end gap-1">
                    <Button size="sm" variant="outline" disabled={test.isPending} onClick={() => test.mutate(t.id)}>
                      <Activity className="w-3.5 h-3.5 mr-1" />Test
                    </Button>
                    {isEditor && (
                      <Button size="sm" variant="ghost" onClick={() => openEdit(t)}>
                        <Pencil className="w-3.5 h-3.5" />
                      </Button>
                    )}
                    {isAdmin && (
                      <ConfirmDialog
                        title="Delete storage target?"
                        description="This permanently removes the registration. Health-check history will also be cleared."
                        confirmText="Delete"
                        destructive
                        onConfirm={async () => {
                          await deleteFn({ data: { id: t.id } });
                          toast.success("Storage target removed");
                          qc.invalidateQueries({ queryKey: ["storage-targets"] });
                        }}
                        trigger={
                          <Button size="sm" variant="ghost" className="text-destructive">
                            <Trash2 className="w-3.5 h-3.5" />
                          </Button>
                        }
                      />
                    )}
                  </div>
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogTrigger asChild><span className="hidden" /></DialogTrigger>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>{form.id ? "Edit storage target" : "New storage target"}</DialogTitle>
          </DialogHeader>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 max-h-[70vh] overflow-y-auto pr-1">
            <div className="sm:col-span-2">
              <Label>Station *</Label>
              <Select value={form.station_id} onValueChange={(v) => setForm({ ...form, station_id: v })}>
                <SelectTrigger><SelectValue placeholder="Select station" /></SelectTrigger>
                <SelectContent>
                  {(stations.data ?? []).map((s: any) => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Name *</Label>
              <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Radio Uppsala Media" />
            </div>
            <div>
              <Label>Provider *</Label>
              <Select value={form.provider} onValueChange={(v) => setForm({ ...form, provider: v as Provider })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {PROVIDERS.map((p) => <SelectItem key={p.value} value={p.value}>{p.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Purpose *</Label>
              <Select value={form.purpose} onValueChange={(v) => setForm({ ...form, purpose: v as Purpose })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {PURPOSES.map((p) => <SelectItem key={p.value} value={p.value}>{p.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Bucket</Label>
              <Input value={form.bucket} onChange={(e) => setForm({ ...form, bucket: e.target.value })} placeholder="radio-core-media" />
            </div>
            <div className="sm:col-span-2">
              <Label>Endpoint URL</Label>
              <Input value={form.endpoint_url} onChange={(e) => setForm({ ...form, endpoint_url: e.target.value })} placeholder="https://<account>.r2.cloudflarestorage.com" />
            </div>
            <div>
              <Label>Region</Label>
              <Input value={form.region} onChange={(e) => setForm({ ...form, region: e.target.value })} placeholder="auto" />
            </div>
            <div>
              <Label>Public base URL</Label>
              <Input value={form.public_base_url} onChange={(e) => setForm({ ...form, public_base_url: e.target.value })} placeholder="https://media.example.com" />
            </div>
            <div>
              <Label>Access key secret ref</Label>
              <Input value={form.access_key_ref} onChange={(e) => setForm({ ...form, access_key_ref: e.target.value })} placeholder="S3_ACCESS_KEY_ID" />
              <p className="text-[10px] text-muted-foreground mt-1">Name of the env var holding the access key ID. Never paste raw keys here.</p>
            </div>
            <div>
              <Label>Secret key secret ref</Label>
              <Input value={form.secret_key_ref} onChange={(e) => setForm({ ...form, secret_key_ref: e.target.value })} placeholder="S3_SECRET_ACCESS_KEY" />
              <p className="text-[10px] text-muted-foreground mt-1">Name of the env var holding the secret. Stored as a reference only.</p>
            </div>
            <div className="flex items-center gap-2 sm:col-span-2">
              <Switch id="active" checked={form.is_active} onCheckedChange={(v) => setForm({ ...form, is_active: v })} />
              <Label htmlFor="active">Active</Label>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
            <Button onClick={() => save.mutate()} disabled={save.isPending}>
              {save.isPending ? "Saving…" : form.id ? "Save" : "Create"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </ResourcePageShell>
  );
}
