import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";
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
import { Plus, Plug, Activity, Trash2, Pencil } from "lucide-react";
import {
  upsertRuntimeTarget, deleteRuntimeTarget, testRuntimeTarget,
} from "@/lib/runtime-targets.functions";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/runtime-targets")({ component: RuntimeTargetsPage });

const TYPES = [
  { value: "azuracast",   label: "AzuraCast" },
  { value: "icecast",     label: "Icecast" },
  { value: "liquidsoap",  label: "Liquidsoap" },
  { value: "stereo_tool", label: "Stereo Tool" },
  { value: "custom",      label: "Custom" },
] as const;

type FormState = {
  id?: string;
  station_id: string;
  name: string;
  type: typeof TYPES[number]["value"];
  base_url: string;
  api_key_secret_name: string;
  external_station_id: string;
  is_active: boolean;
};

const EMPTY_FORM = (station_id = ""): FormState => ({
  station_id, name: "", type: "azuracast", base_url: "",
  api_key_secret_name: "", external_station_id: "", is_active: true,
});

function statusClass(s: string | null | undefined) {
  switch (s) {
    case "ok":       return "bg-success/15 text-success border-success/30";
    case "degraded": return "bg-warning/15 text-warning border-warning/30";
    case "down":
    case "error":    return "bg-destructive/15 text-destructive border-destructive/30";
    default:         return "bg-muted text-muted-foreground border-border";
  }
}

function RuntimeTargetsPage() {
  const qc = useQueryClient();
  const { isAdmin, isEditor } = useAuth();
  const { scope } = useStationScope();
  const [q, setQ] = useState("");
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<FormState>(EMPTY_FORM());
  const [confirmDel, setConfirmDel] = useState<string | null>(null);

  const stations = useQuery({
    queryKey: ["stations-list"],
    queryFn: async () => (await supabase.from("stations").select("id,name").order("name")).data ?? [],
  });

  const targets = useQuery({
    queryKey: ["runtime-targets"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("runtime_targets")
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
        r.type.toLowerCase().includes(needle) ||
        (r.base_url ?? "").toLowerCase().includes(needle));
    }
    return rows;
  }, [targets.data, scope, q]);

  const upsertFn = useServerFn(upsertRuntimeTarget);
  const deleteFn = useServerFn(deleteRuntimeTarget);
  const testFn = useServerFn(testRuntimeTarget);

  const save = useMutation({
    mutationFn: async () => {
      if (!form.station_id) throw new Error("Station is required");
      if (!form.name.trim()) throw new Error("Name is required");
      return upsertFn({ data: {
        id: form.id,
        station_id: form.station_id,
        name: form.name.trim(),
        type: form.type,
        base_url: form.base_url.trim() || null,
        api_key_secret_name: form.api_key_secret_name.trim() || null,
        external_station_id: form.external_station_id.trim() || null,
        is_active: form.is_active,
      }});
    },
    onSuccess: () => {
      toast.success(form.id ? "Target updated" : "Target created");
      setOpen(false);
      setForm(EMPTY_FORM(scope.kind === "station" ? scope.station.id : ""));
      qc.invalidateQueries({ queryKey: ["runtime-targets"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const del = useMutation({
    mutationFn: async (id: string) => deleteFn({ data: { id } }),
    onSuccess: () => {
      toast.success("Target removed");
      setConfirmDel(null);
      qc.invalidateQueries({ queryKey: ["runtime-targets"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const test = useMutation({
    mutationFn: async (id: string) => testFn({ data: { id } }),
    onSuccess: (r: any) => {
      if (r.ok) toast.success(`Reachable (${r.duration_ms}ms): ${r.message}`);
      else toast.error(`Failed (${r.duration_ms}ms): ${r.message}`);
      qc.invalidateQueries({ queryKey: ["runtime-targets"] });
      qc.invalidateQueries({ queryKey: ["runtime-health-checks"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const openCreate = () => {
    setForm(EMPTY_FORM(scope.kind === "station" ? scope.station.id : ""));
    setOpen(true);
  };
  const openEdit = (t: any) => {
    setForm({
      id: t.id, station_id: t.station_id, name: t.name, type: t.type,
      base_url: t.base_url ?? "", api_key_secret_name: t.api_key_secret_name ?? "",
      external_station_id: t.external_station_id ?? "", is_active: t.is_active,
    });
    setOpen(true);
  };

  const state =
    targets.isLoading ? { kind: "loading" as const } :
    targets.error    ? { kind: "error" as const, message: (targets.error as Error).message, retry: () => targets.refetch() } :
    visible.length === 0 ? {
      kind: "empty" as const,
      title: "No runtime targets",
      hint: "Register a runtime service (AzuraCast, Icecast, …) to start managing it from Radio Core.",
      action: isEditor ? <Button onClick={openCreate}><Plus className="w-4 h-4 mr-1" />New target</Button> : undefined,
    } :
    { kind: "ready" as const };

  return (
    <ResourcePageShell
      title="Runtime Targets"
      description="External broadcast services connected to this control plane."
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
            <TableHead>Type</TableHead>
            <TableHead>Station</TableHead>
            <TableHead>Status</TableHead>
            <TableHead>Base URL</TableHead>
            <TableHead>Last checked</TableHead>
            <TableHead className="text-right">Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {visible.map((t: any) => (
            <TableRow key={t.id}>
              <TableCell className="font-medium">
                <div className="flex items-center gap-2"><Plug className="w-3.5 h-3.5 text-muted-foreground" />{t.name}</div>
                {t.last_error && <div className="text-[11px] text-destructive truncate max-w-[260px]" title={t.last_error}>{t.last_error}</div>}
              </TableCell>
              <TableCell><Badge variant="outline" className="text-[10px] uppercase">{t.type}</Badge></TableCell>
              <TableCell className="text-sm text-muted-foreground">{t.stations?.name ?? "—"}</TableCell>
              <TableCell>
                <Badge variant="outline" className={cn("text-[10px] uppercase", statusClass(t.status))}>{t.status}</Badge>
              </TableCell>
              <TableCell className="text-xs font-mono truncate max-w-[220px]" title={t.base_url ?? ""}>{t.base_url ?? "—"}</TableCell>
              <TableCell className="text-xs text-muted-foreground">{t.last_checked_at ? new Date(t.last_checked_at).toLocaleString() : "—"}</TableCell>
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
                    <Button size="sm" variant="ghost" className="text-destructive" onClick={() => setConfirmDel(t.id)}>
                      <Trash2 className="w-3.5 h-3.5" />
                    </Button>
                  )}
                </div>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogTrigger asChild><span className="hidden" /></DialogTrigger>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle>{form.id ? "Edit runtime target" : "New runtime target"}</DialogTitle></DialogHeader>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
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
              <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Main AzuraCast" />
            </div>
            <div>
              <Label>Type *</Label>
              <Select value={form.type} onValueChange={(v) => setForm({ ...form, type: v as FormState["type"] })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {TYPES.map((t) => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="sm:col-span-2">
              <Label>Base URL</Label>
              <Input value={form.base_url} onChange={(e) => setForm({ ...form, base_url: e.target.value })} placeholder="https://radio.example.com" />
            </div>
            <div>
              <Label>API key secret name</Label>
              <Input value={form.api_key_secret_name} onChange={(e) => setForm({ ...form, api_key_secret_name: e.target.value })} placeholder="AZURACAST_API_KEY" />
            </div>
            <div>
              <Label>External station ID</Label>
              <Input value={form.external_station_id} onChange={(e) => setForm({ ...form, external_station_id: e.target.value })} placeholder="1" />
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

      {/* Delete confirmation handled inline via AlertDialog */}
    </ResourcePageShell>
  );
}
