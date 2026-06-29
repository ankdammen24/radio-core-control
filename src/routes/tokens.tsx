/**
 * Radio Core — Stack Tokens admin page.
 *
 * Admins can create, list, and revoke stack tokens used by runners and API consumers.
 *
 * Security invariants enforced in this UI:
 *  - token_hash is never requested or displayed
 *  - raw_secret is shown exactly once in a copy-and-dismiss dialog
 *  - raw_secret is cleared from React state when the dialog closes
 *  - only users with the 'admin' role can reach this page (enforced server-side too)
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
import {
  AlertDialog, AlertDialogContent, AlertDialogHeader, AlertDialogTitle,
  AlertDialogDescription, AlertDialogFooter, AlertDialogAction,
} from "@/components/ui/alert-dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ConfirmDialog } from "@/components/confirm-dialog";
import { useAuth } from "@/lib/auth";
import { toast } from "sonner";
import { Plus, Key, ShieldOff, Copy, Check, AlertTriangle } from "lucide-react";
import {
  listStackTokens, createStackToken, revokeStackToken, TOKEN_PURPOSES, type StackTokenRow,
} from "@/lib/tokens.functions";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/tokens")({ component: TokensPage });

type FormState = {
  name: string;
  purpose: typeof TOKEN_PURPOSES[number];
  station_id: string;
};

const EMPTY_FORM = (): FormState => ({ name: "", purpose: "runner", station_id: "" });

const PURPOSE_LABELS: Record<string, string> = {
  runner: "Runner",
  agent: "Agent",
  api: "API",
};

function relativeTime(iso: string | null): string {
  if (!iso) return "—";
  const d = new Date(iso);
  const secs = Math.floor((Date.now() - d.getTime()) / 1000);
  if (secs < 60) return "just now";
  if (secs < 3600) return `${Math.floor(secs / 60)}m ago`;
  if (secs < 86400) return `${Math.floor(secs / 3600)}h ago`;
  return d.toLocaleDateString();
}

function TokensPage() {
  const qc = useQueryClient();
  const { isAdmin } = useAuth();
  const [q, setQ] = useState("");
  const [createOpen, setCreateOpen] = useState(false);
  const [form, setForm] = useState<FormState>(EMPTY_FORM());
  // Raw secret state: shown once, cleared on dialog close
  const [revealedSecret, setRevealedSecret] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const stations = useQuery({
    queryKey: ["stations-list"],
    queryFn: async () => (await supabase.from("stations").select("id,name").order("name")).data ?? [],
  });

  const tokens = useQuery({
    queryKey: ["stack-tokens"],
    queryFn: async () => {
      const result = await listFn({ data: {} });
      return result.tokens;
    },
  });

  const listFn   = useServerFn(listStackTokens);
  const createFn = useServerFn(createStackToken);
  const revokeFn = useServerFn(revokeStackToken);

  const visible = (tokens.data ?? []).filter((t) => {
    if (!q.trim()) return true;
    const needle = q.toLowerCase();
    return (
      t.name.toLowerCase().includes(needle) ||
      t.purpose.toLowerCase().includes(needle)
    );
  });

  const createMutation = useMutation({
    mutationFn: async () => {
      if (!form.name.trim()) throw new Error("Name is required");
      return createFn({
        data: {
          name: form.name.trim(),
          purpose: form.purpose,
          station_id: form.station_id || null,
        },
      });
    },
    onSuccess: (result) => {
      toast.success("Token created");
      setCreateOpen(false);
      setForm(EMPTY_FORM());
      qc.invalidateQueries({ queryKey: ["stack-tokens"] });
      // Surface the raw secret in the reveal dialog
      setRevealedSecret(result.raw_secret);
      setCopied(false);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const revokeMutation = useMutation({
    mutationFn: async (id: string) => revokeFn({ data: { id } }),
    onSuccess: () => {
      toast.success("Token revoked");
      qc.invalidateQueries({ queryKey: ["stack-tokens"] });
      qc.invalidateQueries({ queryKey: ["agents"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const copySecret = async () => {
    if (!revealedSecret) return;
    await navigator.clipboard.writeText(revealedSecret);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const dismissSecret = () => {
    setRevealedSecret(null);
    setCopied(false);
  };

  const state =
    tokens.isLoading ? { kind: "loading" as const } :
    tokens.error ? {
      kind: "error" as const,
      message: (tokens.error as Error).message,
      retry: () => tokens.refetch(),
    } :
    visible.length === 0 ? {
      kind: "empty" as const,
      title: "No stack tokens",
      hint: isAdmin
        ? "Create a token to pair with a runner or API consumer."
        : "No tokens have been issued yet.",
      action: isAdmin ? (
        <Button onClick={() => setCreateOpen(true)}>
          <Plus className="w-4 h-4 mr-1" />New token
        </Button>
      ) : undefined,
    } :
    { kind: "ready" as const };

  if (!isAdmin) {
    return (
      <div className="p-8 text-center text-muted-foreground">
        <ShieldOff className="w-8 h-8 mx-auto mb-3 opacity-40" />
        <p className="text-sm">Admin role required to manage tokens.</p>
      </div>
    );
  }

  return (
    <>
      <ResourcePageShell
        title="Stack Tokens"
        description="Long-lived secrets used by runners and API consumers to authenticate against Radio Core."
        searchValue={q}
        onSearchChange={setQ}
        searchPlaceholder="Search tokens…"
        primaryAction={(
          <Button size="sm" onClick={() => setCreateOpen(true)}>
            <Plus className="w-4 h-4 mr-1" />New token
          </Button>
        )}
        state={state}
      >
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead>Purpose</TableHead>
              <TableHead>Station</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Last used</TableHead>
              <TableHead>Created</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {visible.map((t: StackTokenRow) => (
              <TableRow key={t.id} className={cn(!t.is_active && "opacity-50")}>
                <TableCell className="font-medium">
                  <div className="flex items-center gap-2">
                    <Key className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
                    <span>{t.name}</span>
                  </div>
                  {t.revoked_at && (
                    <div className="text-[10px] text-destructive mt-0.5">
                      Revoked {relativeTime(t.revoked_at)}
                    </div>
                  )}
                </TableCell>
                <TableCell>
                  <Badge variant="outline" className="text-[10px] uppercase">
                    {PURPOSE_LABELS[t.purpose] ?? t.purpose}
                  </Badge>
                </TableCell>
                <TableCell className="text-sm text-muted-foreground">
                  {t.station_id
                    ? (stations.data ?? []).find((s: any) => s.id === t.station_id)?.name ?? t.station_id
                    : <span className="italic opacity-60">Global</span>
                  }
                </TableCell>
                <TableCell>
                  <Badge
                    variant="outline"
                    className={cn(
                      "text-[10px] uppercase",
                      t.is_active
                        ? "bg-success/10 text-success border-success/30"
                        : "bg-muted text-muted-foreground",
                    )}
                  >
                    {t.is_active ? "Active" : "Revoked"}
                  </Badge>
                </TableCell>
                <TableCell className="text-xs text-muted-foreground">
                  {relativeTime(t.last_used_at)}
                </TableCell>
                <TableCell className="text-xs text-muted-foreground">
                  {new Date(t.created_at).toLocaleDateString()}
                </TableCell>
                <TableCell className="text-right">
                  {t.is_active && (
                    <ConfirmDialog
                      title="Revoke token?"
                      description={`This permanently disables "${t.name}". Any runner or agent using it will stop authenticating immediately.`}
                      confirmText="Revoke"
                      destructive
                      onConfirm={() => revokeMutation.mutate(t.id)}
                      trigger={
                        <Button size="sm" variant="ghost" className="text-destructive" disabled={revokeMutation.isPending}>
                          <ShieldOff className="w-3.5 h-3.5 mr-1" />Revoke
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

      {/* ── Create token dialog ─────────────────────────────────────── */}
      <Dialog open={createOpen} onOpenChange={(v) => { setCreateOpen(v); if (!v) setForm(EMPTY_FORM()); }}>
        <DialogTrigger asChild><span className="hidden" /></DialogTrigger>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>New stack token</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label>Name *</Label>
              <Input
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                placeholder="vps-stockholm-runner"
                autoFocus
              />
              <p className="text-[11px] text-muted-foreground mt-1">
                A memorable name for this token (e.g. the VPS hostname).
              </p>
            </div>
            <div>
              <Label>Purpose *</Label>
              <Select
                value={form.purpose}
                onValueChange={(v) => setForm({ ...form, purpose: v as typeof TOKEN_PURPOSES[number] })}
              >
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="runner">Runner — broadcast VPS daemon</SelectItem>
                  <SelectItem value="agent">Agent — Radio Core agent instance</SelectItem>
                  <SelectItem value="api">API — external integration</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Station scope</Label>
              <Select
                value={form.station_id}
                onValueChange={(v) => setForm({ ...form, station_id: v })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Global (all stations)" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="">Global (all stations)</SelectItem>
                  {(stations.data ?? []).map((s: any) => (
                    <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-[11px] text-muted-foreground mt-1">
                Station-scoped tokens can only access that station's config. Runners should always be station-scoped.
              </p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setCreateOpen(false); setForm(EMPTY_FORM()); }}>
              Cancel
            </Button>
            <Button
              onClick={() => createMutation.mutate()}
              disabled={createMutation.isPending || !form.name.trim()}
            >
              {createMutation.isPending ? "Creating…" : "Create token"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Reveal secret dialog — shown ONCE after creation ────────── */}
      <AlertDialog open={!!revealedSecret}>
        <AlertDialogContent className="max-w-lg">
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-warning" />
              Copy your token now
            </AlertDialogTitle>
            <AlertDialogDescription>
              This is the only time the token secret will be shown. It cannot be recovered after
              closing this dialog. Store it securely — paste it into your runner's
              <code className="mx-1 px-1 rounded bg-muted text-xs">RADIO_CORE_STACK_TOKEN</code>
              environment variable.
            </AlertDialogDescription>
          </AlertDialogHeader>

          <div className="my-2 p-3 rounded-md bg-muted border border-border font-mono text-xs break-all select-all">
            {revealedSecret}
          </div>

          <AlertDialogFooter className="gap-2 flex-col sm:flex-row">
            <Button variant="outline" size="sm" onClick={copySecret} className="gap-2">
              {copied
                ? <><Check className="w-3.5 h-3.5 text-success" />Copied!</>
                : <><Copy className="w-3.5 h-3.5" />Copy to clipboard</>
              }
            </Button>
            <AlertDialogAction onClick={dismissSecret}>
              I've saved the token — close
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
