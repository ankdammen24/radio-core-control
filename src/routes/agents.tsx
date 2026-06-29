/**
 * Radio Core — Agents page.
 *
 * Shows registered runtime agents (runners) and their live status derived from
 * heartbeat data. Admins can register, edit, trigger config reloads, revoke and
 * delete agents.
 *
 * Status is computed client-side from last_seen_at:
 *   online   → last heartbeat < ONLINE_TIMEOUT_MS ago
 *   offline  → last heartbeat ≥ ONLINE_TIMEOUT_MS ago (or never seen)
 *   The DB status column is used as the canonical persisted value;
 *   UI overrides it with the freshness check for real-time display.
 *
 * See: docs/architecture/radio-core-v2.md §7 — Runner: stateless agent
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
import {
  Tooltip, TooltipContent, TooltipProvider, TooltipTrigger,
} from "@/components/ui/tooltip";
import { ConfirmDialog } from "@/components/confirm-dialog";
import { useAuth } from "@/lib/auth";
import { useStationScope } from "@/lib/station-context";
import { toast } from "sonner";
import {
  Plus, Cpu, Trash2, Pencil, ShieldOff, RefreshCw, Wifi, WifiOff,
  Activity, MemoryStick, HardDrive, Zap,
} from "lucide-react";
import {
  listAgents, upsertAgent, deleteAgent, revokeAgentNow, requestAgentReload,
} from "@/lib/agents.functions";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/agents")({ component: AgentsPage });

// Agent is considered online if it sent a heartbeat within this window
const ONLINE_TIMEOUT_MS = 2 * 60 * 1000; // 2 minutes
// Auto-refresh interval (agents send heartbeat every ~30 s)
const REFRESH_INTERVAL_MS = 30_000;

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

// ─── Status helpers ───────────────────────────────────────────────────────────

function effectiveStatus(agent: { status: string; last_seen_at: string | null }): "online" | "offline" | "unknown" {
  if (!agent.last_seen_at) return "unknown";
  const age = Date.now() - new Date(agent.last_seen_at).getTime();
  if (age < ONLINE_TIMEOUT_MS) return "online";
  return "offline";
}

function statusBadgeClass(s: "online" | "offline" | "unknown") {
  switch (s) {
    case "online":  return "bg-success/15 text-success border-success/30";
    case "offline": return "bg-destructive/15 text-destructive border-destructive/30";
    default:        return "bg-muted text-muted-foreground border-border";
  }
}

function StatusDot({ status }: { status: "online" | "offline" | "unknown" }) {
  return (
    <span className={cn(
      "inline-block w-2 h-2 rounded-full shrink-0",
      status === "online"  ? "bg-success animate-pulse" :
      status === "offline" ? "bg-destructive" :
      "bg-muted-foreground/40",
    )} />
  );
}

// ─── Formatters ───────────────────────────────────────────────────────────────

function relativeTime(iso: string | null): string {
  if (!iso) return "Never";
  const secs = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
  if (secs < 5)    return "just now";
  if (secs < 60)   return `${secs}s ago`;
  if (secs < 3600) return `${Math.floor(secs / 60)}m ago`;
  if (secs < 86400) return `${Math.floor(secs / 3600)}h ago`;
  return new Date(iso).toLocaleDateString();
}

// ─── Capabilities badge list ──────────────────────────────────────────────────

function CapabilityBadges({ capabilities }: { capabilities: unknown }) {
  if (!capabilities || typeof capabilities !== "object" || Array.isArray(capabilities)) return <span className="text-muted-foreground text-xs">—</span>;
  const caps = capabilities as Record<string, unknown>;
  const active = Object.entries(caps).filter(([, v]) => Boolean(v)).map(([k]) => k);
  if (!active.length) return <span className="text-muted-foreground text-xs">none</span>;
  return (
    <div className="flex flex-wrap gap-1">
      {active.map((c) => (
        <Badge key={c} variant="outline" className="text-[9px] uppercase tracking-wider px-1 py-0">
          {c.replace(/_/g, " ")}
        </Badge>
      ))}
    </div>
  );
}

// ─── Metrics display ──────────────────────────────────────────────────────────

function MetricsDisplay({ metrics }: { metrics: unknown }) {
  if (!metrics || typeof metrics !== "object" || Array.isArray(metrics)) return <span className="text-xs text-muted-foreground">—</span>;
  const m = metrics as Record<string, unknown>;
  const cpu   = typeof m.cpu === "number" ? `${(m.cpu * 100).toFixed(0)}%` : null;
  const memMb = typeof m.memory_mb === "number" ? `${m.memory_mb} MB` : null;
  const diskGb = typeof m.disk_free_mb === "number" ? `${(m.disk_free_mb / 1024).toFixed(1)} GB` : null;
  if (!cpu && !memMb && !diskGb) return <span className="text-xs text-muted-foreground">—</span>;
  return (
    <div className="flex flex-col gap-0.5 text-[11px] text-muted-foreground font-mono">
      {cpu    && <span className="flex items-center gap-1"><Activity className="w-3 h-3 shrink-0" /> {cpu} CPU</span>}
      {memMb  && <span className="flex items-center gap-1"><MemoryStick className="w-3 h-3 shrink-0" /> {memMb}</span>}
      {diskGb && <span className="flex items-center gap-1"><HardDrive className="w-3 h-3 shrink-0" /> {diskGb} free</span>}
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

function AgentsPage() {
  const qc = useQueryClient();
  const { isAdmin } = useAuth();
  const { scope } = useStationScope();
  const stationId = scope.kind === "station" ? scope.station.id : null;
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<FormState>(EMPTY_FORM());

  const listFn   = useServerFn(listAgents);
  const upsertFn = useServerFn(upsertAgent);
  const removeFn = useServerFn(deleteAgent);
  const revokeFn = useServerFn(revokeAgentNow);
  const reloadFn = useServerFn(requestAgentReload);

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
        .in("purpose", ["runner", "agent"])
        .eq("is_active", true)
        .order("created_at", { ascending: false });
      return data ?? [];
    },
  });

  const agents = useQuery({
    queryKey: ["agents", stationId ?? "all"],
    queryFn: () => listFn({ data: { station_id: stationId } }),
    refetchInterval: REFRESH_INTERVAL_MS,
  });

  const mUpsert = useMutation({
    mutationFn: async (f: FormState) =>
      upsertFn({
        data: {
          id: f.id,
          station_id: f.station_id || null,
          name: f.name.trim(),
          hostname: f.hostname.trim() || null,
          version: f.version.trim() || null,
          stack_token_id: f.stack_token_id || null,
        },
      }),
    onSuccess: () => {
      toast.success("Agent saved");
      setOpen(false);
      setForm(EMPTY_FORM(stationId ?? ""));
      qc.invalidateQueries({ queryKey: ["agents"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const mDelete = useMutation({
    mutationFn: async (id: string) => removeFn({ data: { id } }),
    onSuccess: () => { toast.success("Agent removed"); qc.invalidateQueries({ queryKey: ["agents"] }); },
    onError: (e: Error) => toast.error(e.message),
  });

  const mRevoke = useMutation({
    mutationFn: async (id: string) => revokeFn({ data: { id } }),
    onSuccess: () => { toast.success("Agent revoked"); qc.invalidateQueries({ queryKey: ["agents"] }); },
    onError: (e: Error) => toast.error(e.message),
  });

  const mReload = useMutation({
    mutationFn: async (id: string) => reloadFn({ data: { id } }),
    onSuccess: () => { toast.success("Reload requested — runner will pick it up on next heartbeat"); qc.invalidateQueries({ queryKey: ["agents"] }); },
    onError: (e: Error) => toast.error(e.message),
  });

  const rows = agents.data?.agents ?? [];

  const state =
    agents.isLoading ? { kind: "loading" as const } :
    agents.error     ? {
      kind: "error" as const,
      message: (agents.error as Error).message,
      retry: () => agents.refetch(),
    } :
    rows.length === 0 ? {
      kind: "empty" as const,
      title: "No agents registered",
      hint: "Register a runner agent and pair it with a stack token. The runner will report its heartbeat to this page.",
      action: isAdmin ? (
        <Button onClick={() => setOpen(true)}>
          <Plus className="w-4 h-4 mr-1" />Register agent
        </Button>
      ) : undefined,
    } :
    { kind: "ready" as const };

  return (
    <TooltipProvider>
      <ResourcePageShell
        title="Runtime Agents"
        description="Broadcast runners reporting heartbeats. Auto-refreshes every 30 s."
        searchValue=""
        onSearchChange={() => {}}
        searchPlaceholder=""
        primaryAction={isAdmin ? (
          <Button size="sm" onClick={() => { setForm(EMPTY_FORM(stationId ?? "")); setOpen(true); }}>
            <Plus className="w-4 h-4 mr-1" />Register agent
          </Button>
        ) : undefined}
        state={state}
      >
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Agent</TableHead>
              <TableHead>Station</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Capabilities</TableHead>
              <TableHead>Metrics</TableHead>
              <TableHead>Last seen</TableHead>
              {isAdmin && <TableHead className="text-right">Actions</TableHead>}
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((a: any) => {
              const live   = effectiveStatus(a);
              const sName  = (stations.data ?? []).find((s: any) => s.id === a.station_id)?.name ?? "—";
              const hasPendingReload = Boolean(a.reload_requested_at);
              return (
                <TableRow key={a.id}>
                  {/* Agent name + hostname + version */}
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <StatusDot status={live} />
                      <div>
                        <div className="font-medium text-sm">{a.name}</div>
                        {a.hostname && (
                          <div className="text-[11px] text-muted-foreground font-mono">{a.hostname}</div>
                        )}
                        {a.version && (
                          <div className="text-[10px] text-muted-foreground">v{a.version}</div>
                        )}
                      </div>
                    </div>
                  </TableCell>

                  {/* Station */}
                  <TableCell className="text-sm text-muted-foreground">{sName}</TableCell>

                  {/* Status badge + reload pending indicator */}
                  <TableCell>
                    <div className="flex flex-col gap-1 items-start">
                      <Badge
                        variant="outline"
                        className={cn("text-[10px] uppercase flex items-center gap-1", statusBadgeClass(live))}
                      >
                        {live === "online"  ? <Wifi className="w-3 h-3" /> : <WifiOff className="w-3 h-3" />}
                        {live}
                      </Badge>
                      {hasPendingReload && (
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Badge variant="outline" className="text-[9px] uppercase text-warning border-warning/40 bg-warning/10 flex items-center gap-1 cursor-default">
                              <Zap className="w-3 h-3" />Reload pending
                            </Badge>
                          </TooltipTrigger>
                          <TooltipContent>
                            Requested at {new Date(a.reload_requested_at).toLocaleTimeString()}. Runner will pick up on next heartbeat.
                          </TooltipContent>
                        </Tooltip>
                      )}
                    </div>
                  </TableCell>

                  {/* Capabilities */}
                  <TableCell><CapabilityBadges capabilities={a.capabilities} /></TableCell>

                  {/* Metrics */}
                  <TableCell><MetricsDisplay metrics={a.metrics} /></TableCell>

                  {/* Last seen */}
                  <TableCell className="text-xs text-muted-foreground whitespace-nowrap">
                    {relativeTime(a.last_seen_at)}
                  </TableCell>

                  {/* Actions */}
                  {isAdmin && (
                    <TableCell className="text-right">
                      <div className="inline-flex gap-1 justify-end">
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Button
                              size="sm" variant="ghost"
                              onClick={() => mReload.mutate(a.id)}
                              disabled={mReload.isPending || hasPendingReload}
                              title="Request config reload"
                            >
                              <RefreshCw className={cn("w-3.5 h-3.5", hasPendingReload && "text-warning")} />
                            </Button>
                          </TooltipTrigger>
                          <TooltipContent>
                            {hasPendingReload ? "Reload already pending" : "Request config reload on next heartbeat"}
                          </TooltipContent>
                        </Tooltip>

                        <Button
                          size="sm" variant="ghost"
                          onClick={() => {
                            setForm({
                              id: a.id,
                              station_id: a.station_id ?? "",
                              name: a.name,
                              hostname: a.hostname ?? "",
                              version: a.version ?? "",
                              stack_token_id: a.stack_token_id ?? "",
                            });
                            setOpen(true);
                          }}
                          title="Edit"
                        >
                          <Pencil className="w-3.5 h-3.5" />
                        </Button>

                        <ConfirmDialog
                          title="Revoke agent?"
                          description="Deactivates the linked stack token. The runner will stop authenticating on next attempt."
                          confirmText="Revoke"
                          destructive
                          onConfirm={() => mRevoke.mutate(a.id)}
                          trigger={
                            <Button size="sm" variant="ghost" title="Revoke" disabled={mRevoke.isPending}>
                              <ShieldOff className="w-3.5 h-3.5 text-warning" />
                            </Button>
                          }
                        />

                        <ConfirmDialog
                          title="Delete agent?"
                          description="Removes the registration. The paired stack token is kept — revoke it separately if needed."
                          confirmText="Delete"
                          destructive
                          onConfirm={() => mDelete.mutate(a.id)}
                          trigger={
                            <Button size="sm" variant="ghost" title="Delete">
                              <Trash2 className="w-3.5 h-3.5 text-destructive" />
                            </Button>
                          }
                        />
                      </div>
                    </TableCell>
                  )}
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </ResourcePageShell>

      {/* ── Register / edit agent dialog ─────────────────────────────── */}
      <Dialog open={open} onOpenChange={(v) => { setOpen(v); if (!v) setForm(EMPTY_FORM(stationId ?? "")); }}>
        <DialogTrigger asChild><span className="hidden" /></DialogTrigger>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{form.id ? "Edit agent" : "Register agent"}</DialogTitle>
          </DialogHeader>
          <div className="grid gap-3 py-2">
            <div>
              <Label>Name *</Label>
              <Input
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                placeholder="vps-stockholm-1"
                autoFocus
              />
              <p className="text-[11px] text-muted-foreground mt-1">
                A friendly name. The runner will auto-populate this from its hostname on first heartbeat.
              </p>
            </div>
            <div>
              <Label>Station</Label>
              <Select
                value={form.station_id || "__none"}
                onValueChange={(v) => setForm({ ...form, station_id: v === "__none" ? "" : v })}
              >
                <SelectTrigger><SelectValue placeholder="Account-wide" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none">Account-wide (no station)</SelectItem>
                  {(stations.data ?? []).map((s: any) => (
                    <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Hostname</Label>
                <Input
                  value={form.hostname}
                  onChange={(e) => setForm({ ...form, hostname: e.target.value })}
                  placeholder="agent-01.example.com"
                />
              </div>
              <div>
                <Label>Version</Label>
                <Input
                  value={form.version}
                  onChange={(e) => setForm({ ...form, version: e.target.value })}
                  placeholder="0.1.0"
                />
              </div>
            </div>
            <div>
              <Label>Paired stack token</Label>
              <Select
                value={form.stack_token_id || "__none"}
                onValueChange={(v) => setForm({ ...form, stack_token_id: v === "__none" ? "" : v })}
              >
                <SelectTrigger><SelectValue placeholder="Select token" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none">No token paired yet</SelectItem>
                  {(agentTokens.data ?? []).map((t: any) => (
                    <SelectItem key={t.id} value={t.id}>
                      {t.name} · {t.purpose}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-[11px] text-muted-foreground mt-1">
                Create the token first via Admin → API Tokens. Use purpose "runner" for broadcast VPS daemons.
              </p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setOpen(false)}>Cancel</Button>
            <Button
              onClick={() => mUpsert.mutate(form)}
              disabled={!form.name.trim() || mUpsert.isPending}
            >
              {mUpsert.isPending ? "Saving…" : form.id ? "Save" : "Register"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </TooltipProvider>
  );
}
