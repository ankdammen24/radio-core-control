import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { AppLayout } from "@/components/app-layout";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { StatusBadge } from "@/components/status-badge";
import { PlaceholderNotice } from "@/components/placeholder-notice";
import { ConfirmDialog } from "@/components/confirm-dialog";
import { EmptyState, ErrorState } from "@/components/data-states";
import { Skeleton } from "@/components/ui/skeleton";
import { Plug, Zap, Trash2, ListMusic, Music } from "lucide-react";
import { useState } from "react";
import { useAuth } from "@/lib/auth";
import { toast } from "sonner";
import { azuraConnectionSchema, formatZodError } from "@/lib/validation";
import { logAudit } from "@/lib/audit";

export const Route = createFileRoute("/azuracast")({ component: AzuraPage });

function AzuraPage() {
  const qc = useQueryClient();
  const { isAdmin } = useAuth();
  const [form, setForm] = useState({ station_id: "", base_url: "", azuracast_station_id: "", api_key_secret_name: "AZURACAST_API_KEY" });
  const [errors, setErrors] = useState<string | null>(null);

  const { data: stations } = useQuery({ queryKey:["stations-list"], queryFn: async () => (await supabase.from("stations").select("id,name")).data ?? [] });
  const conns = useQuery({
    queryKey:["azura-conn"],
    queryFn: async () => {
      const { data, error } = await supabase.from("azuracast_connections").select("*, stations(name)").order("created_at", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });

  const save = useMutation({
    mutationFn: async () => {
      const parsed = azuraConnectionSchema.safeParse(form);
      if (!parsed.success) { setErrors(formatZodError(parsed.error)); throw new Error(formatZodError(parsed.error)); }
      setErrors(null);
      const { error } = await supabase.from("azuracast_connections").insert(parsed.data as any);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Connection saved");
      setForm({ station_id: "", base_url: "", azuracast_station_id: "", api_key_secret_name: "AZURACAST_API_KEY" });
      qc.invalidateQueries({ queryKey:["azura-conn"] });
    },
    onError: (e: any) => toast.error(e.message),
  });
  const test = useMutation({
    mutationFn: async (id: string) => {
      const { data, error } = await supabase.functions.invoke("azuracast-test-connection", { body: { connection_id: id } });
      if (error) throw error;
      await logAudit("azuracast.test_connection", "azuracast_connections", id, { result: data });
      return data;
    },
    onSuccess: (d: any) => {
      toast.success(d?.message ?? "Connection tested successfully");
      qc.invalidateQueries({ queryKey:["azura-conn"] });
    },
    onError: (e: any) => toast.error(`Test failed: ${e.message}`),
  });
  const del = useMutation({
    mutationFn: async (id: string) => { const { error } = await supabase.from("azuracast_connections").delete().eq("id", id); if (error) throw error; },
    onSuccess: () => { toast.success("Connection removed"); qc.invalidateQueries({ queryKey:["azura-conn"] }); },
    onError: (e: any) => toast.error(e.message),
  });
  const queueSync = useMutation({
    mutationFn: async ({ station_id, job_type }: { station_id: string; job_type: string }) => {
      const { error } = await supabase.from("sync_jobs").insert({ station_id, job_type, status: "pending", payload: {} });
      if (error) throw error;
      await logAudit(`sync.queue.${job_type}`, "stations", station_id);
    },
    onSuccess: () => toast.success("Sync job queued"),
    onError: (e: any) => toast.error(e.message),
  });

  return (
    <AppLayout title="AzuraCast Integration" description="Configure broadcast server connections. Admin-only.">
      <PlaceholderNotice title="API key stored server-side">
        Add the secret named <code className="font-mono text-xs bg-muted px-1 py-0.5 rounded">AZURACAST_API_KEY</code> in backend secrets. Edge functions use it to talk to AzuraCast — the key never reaches the browser.
      </PlaceholderNotice>

      {!isAdmin && <Card className="p-4 mt-4 border-warning/40 bg-warning/10 text-sm">Admin role required to manage integrations. You may view existing connections only.</Card>}

      {isAdmin && (
        <Card className="p-5 mt-4">
          <h3 className="font-semibold mb-3 flex items-center gap-2"><Plug className="w-4 h-4" />New connection</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div><Label>Station *</Label>
              <Select value={form.station_id} onValueChange={(v) => setForm({ ...form, station_id: v })}>
                <SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger>
                <SelectContent>{stations?.map((s) => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div><Label>AzuraCast base URL *</Label><Input placeholder="https://radio.example.com" value={form.base_url} onChange={(e) => setForm({ ...form, base_url: e.target.value })} /></div>
            <div><Label>Remote station ID *</Label><Input value={form.azuracast_station_id} onChange={(e) => setForm({ ...form, azuracast_station_id: e.target.value })} /></div>
            <div><Label>API key secret name</Label><Input value={form.api_key_secret_name} onChange={(e) => setForm({ ...form, api_key_secret_name: e.target.value })} /></div>
          </div>
          {errors && <p className="text-xs text-destructive mt-3">{errors}</p>}
          <Button className="mt-4" onClick={() => save.mutate()} disabled={save.isPending}>
            {save.isPending ? "Saving…" : "Save connection"}
          </Button>
        </Card>
      )}

      <div className="mt-6 space-y-3">
        {conns.isLoading && <><Skeleton className="h-24" /><Skeleton className="h-24" /></>}
        {conns.error && <ErrorState error={conns.error} onRetry={() => conns.refetch()} />}
        {!conns.isLoading && !conns.error && !conns.data?.length && (
          <EmptyState icon={Plug} title="No AzuraCast connections" description="Add a connection above to enable real-time sync, now-playing data and media import." />
        )}
        {conns.data?.map((c: any) => (
          <Card key={c.id} className="p-5">
            <div className="flex items-start justify-between gap-4 flex-wrap">
              <div className="min-w-0 flex-1">
                <div className="font-semibold">{c.stations?.name}</div>
                <div className="text-xs text-muted-foreground font-mono break-all">{c.base_url ?? "—"} · station {c.azuracast_station_id ?? "—"}</div>
                <div className="mt-2 flex items-center gap-2 flex-wrap">
                  <StatusBadge status={c.status} />
                  <span className="text-xs text-muted-foreground">last tested: {c.last_tested_at ? new Date(c.last_tested_at).toLocaleString() : "never"}</span>
                </div>
              </div>
              <div className="flex items-center gap-2 flex-wrap">
                <Button variant="outline" size="sm" onClick={() => test.mutate(c.id)} disabled={test.isPending}>
                  <Zap className="w-4 h-4 mr-1" />{test.isPending ? "Testing…" : "Test"}
                </Button>
                {isAdmin && (
                  <>
                    <Button variant="outline" size="sm" onClick={() => queueSync.mutate({ station_id: c.station_id, job_type: "azuracast.sync.playlist_to_storage", payload: { playlist_name: "Default" } })}>
                      <Music className="w-4 h-4 mr-1" />Sync Default → R2
                    </Button>
                    <Button variant="outline" size="sm" onClick={() => queueSync.mutate({ station_id: c.station_id, job_type: "playlist_sync" })}>
                      <ListMusic className="w-4 h-4 mr-1" />Sync playlists
                    </Button>
                    <ConfirmDialog
                      title={`Remove connection to ${c.stations?.name}?`}
                      description="This stops Radio Core from syncing with this AzuraCast station. The remote AzuraCast data is not affected."
                      confirmText="Remove"
                      destructive
                      onConfirm={() => del.mutateAsync(c.id)}
                      trigger={<Button variant="ghost" size="sm" className="text-destructive"><Trash2 className="w-4 h-4" /></Button>}
                    />
                  </>
                )}
              </div>
            </div>
          </Card>
        ))}
      </div>
    </AppLayout>
  );
}

