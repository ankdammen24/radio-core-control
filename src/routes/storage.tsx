import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { database } from "@/services/database";
import { ResourcePageShell } from "@/components/resource-page-shell";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Switch } from "@/components/ui/switch";
import { Plus } from "lucide-react";
import { useState } from "react";
import { useAuth } from "@/lib/auth";
import { toast } from "sonner";

export const Route = createFileRoute("/storage")({ component: StoragePage });

function StoragePage() {
  const qc = useQueryClient();
  const { isEditor } = useAuth();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ name: "", type: "local", base_path: "", description: "" });

  const query = useQuery({
    queryKey: ["storage_locations"],
    queryFn: async () => {
      const { data, error } = await database.from("storage_locations").select("*").order("name");
      if (error) throw error;
      return data ?? [];
    },
  });

  const create = useMutation({
    mutationFn: async () => { const { error } = await database.from("storage_locations").insert(form); if (error) throw error; },
    onSuccess: () => { toast.success("Location added"); setOpen(false); qc.invalidateQueries({ queryKey: ["storage_locations"] }); },
    onError: (e: any) => toast.error(e.message),
  });
  const toggle = useMutation({
    mutationFn: async ({ id, val }: { id: string; val: boolean }) => { const { error } = await database.from("storage_locations").update({ is_active: val }).eq("id", id); if (error) throw error; },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["storage_locations"] }),
  });

  const state =
    query.isLoading ? { kind: "loading" as const } :
    query.error ? { kind: "error" as const, message: (query.error as Error).message, retry: () => query.refetch() } :
    (query.data ?? []).length === 0 ? { kind: "empty" as const, title: "No storage locations", hint: "Add a local AzuraCast path or future S3 bucket." } :
    { kind: "ready" as const };

  const primaryAction = isEditor && (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild><Button size="sm"><Plus className="w-4 h-4 mr-1" /> New location</Button></DialogTrigger>
      <DialogContent>
        <DialogHeader><DialogTitle>New storage location</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <div><Label>Name</Label><Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></div>
          <div><Label>Type</Label><Input value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value })} placeholder="local | s3 | other" /></div>
          <div><Label>Base path</Label><Input value={form.base_path} onChange={(e) => setForm({ ...form, base_path: e.target.value })} /></div>
          <div><Label>Description</Label><Input value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} /></div>
        </div>
        <DialogFooter><Button onClick={() => create.mutate()} disabled={!form.name || create.isPending}>{create.isPending ? "Creating…" : "Create"}</Button></DialogFooter>
      </DialogContent>
    </Dialog>
  );

  return (
    <ResourcePageShell
      title="Storage"
      description="Local runtime paths and remote object storage."
      primaryAction={primaryAction}
      hideStationScope
      state={state}
    >
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Name</TableHead>
            <TableHead>Type</TableHead>
            <TableHead>Path</TableHead>
            <TableHead>Active</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {(query.data ?? []).map((s: any) => (
            <TableRow key={s.id}>
              <TableCell className="font-medium">{s.name}</TableCell>
              <TableCell className="text-muted-foreground uppercase text-xs">{s.type}</TableCell>
              <TableCell className="font-mono text-xs">{s.base_path ?? "—"}</TableCell>
              <TableCell><Switch checked={s.is_active} disabled={!isEditor} onCheckedChange={(v) => toggle.mutate({ id: s.id, val: v })} /></TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </ResourcePageShell>
  );
}
