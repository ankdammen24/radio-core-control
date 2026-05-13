/**
 * Radio Core — Agents page.
 *
 * Lists registered agent_instances (Node.js Radio Core Agents) and lets
 * admins create, edit, ping (mocked), revoke, and delete them. Agent
 * authentication is paired via stack_tokens (purpose='agent') — the
 * agent_instances table only stores a pointer (stack_token_id), never the
 * raw secret.
 */
import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
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
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ConfirmDialog } from "@/components/confirm-dialog";
import { useAuth } from "@/lib/auth";
import { useStationScope } from "@/lib/station-context";
import { toast } from "sonner";
import { Plus, Cpu, Activity, Trash2, Pencil, ShieldOff } from "lucide-react";
// Note: icon import for visual reference; ResourcePageShell does not accept it as a prop.
import {
  listAgents, upsertAgent, deleteAgent, pingAgentNow, revokeAgentNow,
} from "@/lib/agents.functions";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/agents")({ component: AgentsPage });

type FormState = {
  id?: string;
  station_id: string;
  name: string;
  hostname: string;
  version: string;
  stack_token_id: string;
};
const EMPTY_FORM = (station_id = ""): FormState => ({
  station_id, name: "", hostname: "", version: "", stack_token_id: "",
});

function statusClass(s: string | null | undefined) {
  switch (s) {
    case "online":   return "bg-success/15 text-success border-success/30";
    case "degraded": return "bg-warning/15 text-warning border-warning/30";
    case "offline":  return "bg-destructive/15 text-destructive border-destructive/30";
    default:         return "bg-muted text-muted-foreground border-border";
  }
}

function AgentsPage() {
  const qc = useQueryClient();
  const { isAdmin } = useAuth();
  const { scope } = useStationScope();
  const stationId = scope.kind === "station" ? scope.station.id : null;
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<FormState>(EMPTY_FORM());

  const list = useServerFn(listAgents);
  const upsert = useServerFn(upsertAgent);
  const remove = useServerFn(deleteAgent);
  const ping = useServerFn(pingAgentNow);
  const revoke = useServerFn(revokeAgentNow);

  const stations = useQuery({
    queryKey: ["stations-list"],
    queryFn: async () => (await supabase.from("stations").select("id,name").order("name")).data ?? [],
  });

  const agentTokens = useQuery({
    queryKey: ["agent-stack-tokens"],
    queryFn: async () => {
      const { data } = await supabase
        .from("stack_tokens")
        .select("id,name,station_id,is_active,purpose")
        .eq("is_active", true)
        .order("created_at", { ascending: false });
      return data ?? [];
    },
  });

  const agents = useQuery({
    queryKey: ["agents", stationId ?? "all"],
    queryFn: () => list({ data: { station_id: stationId } }),
  });

  const mUpsert = useMutation({
    mutationFn: async (f: FormState) =>
      upsert({
        data: {
          id: f.id,
          station_id: f.station_id || null,
          name: f.name.trim(),
          hostname: f.hostname.trim() || null,
          version: f.version.trim() || null,
          stack_token_id: f.stack_token_id || null,
        },
      }),
    onSuccess: () => { toast.success("Agent saved"); setOpen(false); setForm(EMPTY_FORM(stationId ?? "")); qc.invalidateQueries({ queryKey: ["agents"] }); },
    onError: (e: Error) => toast.error(e.message),
  });

  const mDelete = useMutation({
    mutationFn: async (id: string) => remove({ data: { id } }),
    onSuccess: () => { toast.success("Agent removed"); qc.invalidateQueries({ queryKey: ["agents"] }); },
    onError: (e: Error) => toast.error(e.message),
  });

  const mPing = useMutation({
    mutationFn: async (id: string) => ping({ data: { id } }),
    onSuccess: (r) => { toast.success(r.mocked ? "Ping recorded (mocked)" : "Ping sent"); qc.invalidateQueries({ queryKey: ["agents"] }); },
    onError: (e: Error) => toast.error(e.message),
  });

  const mRevoke = useMutation({
    mutationFn: async (id: string) => revoke({ data: { id } }),
    onSuccess: () => { toast.success("Agent revoked"); qc.invalidateQueries({ queryKey: ["agents"] }); },
    onError: (e: Error) => toast.error(e.message),
  });

  const rows = agents.data?.agents ?? [];

  return (
    <ResourcePageShell
      title="Agents"
      description="Node.js Radio Core Agents that run alongside Icecast, Liquidsoap, Stereo Tool and other broadcast services."
      actions={isAdmin && (
        <Dialog open={open} onOpenChange={(v) => { setOpen(v); if (!v) setForm(EMPTY_FORM(stationId ?? "")); }}>
          <DialogTrigger asChild>
            <Button size="sm"><Plus className="w-4 h-4 mr-1.5" />New agent</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>{form.id ? "Edit agent" : "Register agent"}</DialogTitle></DialogHeader>
            <div className="grid gap-3 py-2">
              <div className="grid gap-1.5">
                <Label>Name</Label>
                <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="vps-stockholm-1" />
              </div>
              <div className="grid gap-1.5">
                <Label>Station</Label>
                <Select value={form.station_id || "__none"} onValueChange={(v) => setForm({ ...form, station_id: v === "__none" ? "" : v })}>
                  <SelectTrigger><SelectValue placeholder="Account-wide" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__none">Account-wide (no station)</SelectItem>
                    {(stations.data ?? []).map((s) => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="grid gap-1.5">
                  <Label>Hostname</Label>
                  <Input value={form.hostname} onChange={(e) => setForm({ ...form, hostname: e.target.value })} placeholder="agent-01.example.com" />
                </div>
                <div className="grid gap-1.5">
                  <Label>Version</Label>
                  <Input value={form.version} onChange={(e) => setForm({ ...form, version: e.target.value })} placeholder="0.1.0" />
                </div>
              </div>
              <div className="grid gap-1.5">
                <Label>Paired stack token</Label>
                <Select value={form.stack_token_id || "__none"} onValueChange={(v) => setForm({ ...form, stack_token_id: v === "__none" ? "" : v })}>
                  <SelectTrigger><SelectValue placeholder="Select token" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__none">No token paired yet</SelectItem>
                    {(agentTokens.data ?? []).map((t) => (
                      <SelectItem key={t.id} value={t.id}>
                        {t.name} {t.purpose === "agent" ? "" : "· (api)"}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground">
                  Generate the token from the stack_tokens table; the raw secret is only shown once at creation. Mark its purpose as &quot;agent&quot; to keep API and agent tokens distinct.
                </p>
              </div>
            </div>
            <DialogFooter>
              <Button variant="ghost" onClick={() => setOpen(false)}>Cancel</Button>
              <Button onClick={() => mUpsert.mutate(form)} disabled={!form.name || mUpsert.isPending}>
                {mUpsert.isPending ? "Saving…" : "Save"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
    >
      {agents.isLoading ? (
        <div className="text-sm text-muted-foreground p-6">Loading agents…</div>
      ) : rows.length === 0 ? (
        <div className="rounded-md border border-dashed border-border p-10 text-center">
          <Cpu className="w-8 h-8 mx-auto text-muted-foreground mb-2" />
          <p className="text-sm font-medium">No agents registered yet.</p>
          <p className="text-xs text-muted-foreground mt-1">
            Register an agent to let a Node.js process running on your VPS or in Docker drive Icecast, Liquidsoap, Stereo Tool and storage operations.
          </p>
        </div>
      ) : (
        <div className="rounded-md border border-border overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Station</TableHead>
                <TableHead>Hostname</TableHead>
                <TableHead>Version</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Last seen</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((a) => {
                const stationName = (stations.data ?? []).find((s) => s.id === a.station_id)?.name ?? "—";
                return (
                  <TableRow key={a.id}>
                    <TableCell className="font-medium">{a.name}</TableCell>
                    <TableCell className="text-muted-foreground">{stationName}</TableCell>
                    <TableCell className="text-muted-foreground">{a.hostname ?? "—"}</TableCell>
                    <TableCell className="text-muted-foreground">{a.version ?? "—"}</TableCell>
                    <TableCell>
                      <Badge variant="outline" className={cn("text-[10px] uppercase tracking-wider", statusClass(a.status))}>
                        {a.status}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-muted-foreground text-xs">
                      {a.last_seen_at ? new Date(a.last_seen_at).toLocaleString() : "Never"}
                    </TableCell>
                    <TableCell className="text-right">
                      {isAdmin && (
                        <div className="inline-flex gap-1">
                          <Button size="sm" variant="ghost" onClick={() => mPing.mutate(a.id)} title="Ping">
                            <Activity className="w-4 h-4" />
                          </Button>
                          <Button size="sm" variant="ghost" onClick={() => { setForm({ id: a.id, station_id: a.station_id ?? "", name: a.name, hostname: a.hostname ?? "", version: a.version ?? "", stack_token_id: a.stack_token_id ?? "" }); setOpen(true); }} title="Edit">
                            <Pencil className="w-4 h-4" />
                          </Button>
                          <ConfirmDialog
                            title="Revoke agent?"
                            description="Deactivates the linked stack token and marks the agent offline. The agent will no longer be able to authenticate."
                            confirmText="Revoke"
                            onConfirm={() => mRevoke.mutate(a.id)}
                            trigger={<Button size="sm" variant="ghost" title="Revoke"><ShieldOff className="w-4 h-4" /></Button>}
                          />
                          <ConfirmDialog
                            title="Delete agent?"
                            description="Permanently removes the agent registration. The paired stack token is kept; revoke it separately if needed."
                            confirmText="Delete"
                            onConfirm={() => mDelete.mutate(a.id)}
                            trigger={<Button size="sm" variant="ghost" title="Delete"><Trash2 className="w-4 h-4 text-destructive" /></Button>}
                          />
                        </div>
                      )}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      )}
    </ResourcePageShell>
  );
}
