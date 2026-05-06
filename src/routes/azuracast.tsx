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
import { Plug, Zap } from "lucide-react";
import { useState } from "react";
import { useAuth } from "@/lib/auth";
import { toast } from "sonner";

export const Route = createFileRoute("/azuracast")({ component: AzuraPage });

function AzuraPage() {
  const qc = useQueryClient();
  const { isEditor } = useAuth();
  const [form, setForm] = useState({ station_id: "", base_url: "", azuracast_station_id: "", api_key_secret_name: "AZURACAST_API_KEY" });

  const { data: stations } = useQuery({ queryKey:["stations-list"], queryFn: async () => (await supabase.from("stations").select("id,name")).data ?? [] });
  const { data: connections } = useQuery({
    queryKey:["azura-conn"],
    queryFn: async () => (await supabase.from("azuracast_connections").select("*, stations(name)").order("created_at", { ascending: false })).data ?? [],
  });

  const save = useMutation({
    mutationFn: async () => { const { error } = await supabase.from("azuracast_connections").insert(form as any); if (error) throw error; },
    onSuccess: () => { toast.success("Connection saved"); qc.invalidateQueries({ queryKey:["azura-conn"] }); },
    onError: (e: any) => toast.error(e.message),
  });
  const test = useMutation({
    mutationFn: async (id: string) => {
      const { data, error } = await supabase.functions.invoke("azuracast-test-connection", { body: { connection_id: id } });
      if (error) throw error;
      return data;
    },
    onSuccess: (d: any) => toast.success(d?.message ?? "Connection tested"),
    onError: (e: any) => toast.error(e.message),
  });

  return (
    <AppLayout title="AzuraCast Integration" description="Configure broadcast server connection. API keys are kept server-side.">
      <PlaceholderNotice title="API key stored server-side">
        Add the secret named <code className="font-mono text-xs bg-muted px-1 py-0.5 rounded">AZURACAST_API_KEY</code> in backend secrets. Edge functions use it to talk to AzuraCast — the key never reaches the browser.
      </PlaceholderNotice>

      {isEditor && (
        <Card className="p-5 mt-4">
          <h3 className="font-semibold mb-3 flex items-center gap-2"><Plug className="w-4 h-4" />New connection</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div><Label>Station</Label>
              <Select value={form.station_id} onValueChange={(v) => setForm({ ...form, station_id: v })}>
                <SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger>
                <SelectContent>{stations?.map((s) => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div><Label>AzuraCast base URL</Label><Input placeholder="https://radio.example.com" value={form.base_url} onChange={(e) => setForm({ ...form, base_url: e.target.value })} /></div>
            <div><Label>Remote station ID</Label><Input value={form.azuracast_station_id} onChange={(e) => setForm({ ...form, azuracast_station_id: e.target.value })} /></div>
            <div><Label>API key secret name</Label><Input value={form.api_key_secret_name} onChange={(e) => setForm({ ...form, api_key_secret_name: e.target.value })} /></div>
          </div>
          <Button className="mt-4" onClick={() => save.mutate()} disabled={!form.station_id}>Save connection</Button>
        </Card>
      )}

      <div className="mt-6 space-y-3">
        {connections?.map((c: any) => (
          <Card key={c.id} className="p-5 flex items-center justify-between gap-4">
            <div>
              <div className="font-semibold">{c.stations?.name}</div>
              <div className="text-xs text-muted-foreground font-mono">{c.base_url ?? "—"} · station {c.azuracast_station_id ?? "—"}</div>
              <div className="mt-1 flex items-center gap-2"><StatusBadge status={c.status} /><span className="text-xs text-muted-foreground">last tested: {c.last_tested_at ? new Date(c.last_tested_at).toLocaleString() : "never"}</span></div>
            </div>
            <Button variant="outline" size="sm" onClick={() => test.mutate(c.id)} disabled={test.isPending}><Zap className="w-4 h-4 mr-1" />Test</Button>
          </Card>
        ))}
        {!connections?.length && <Card className="p-8 text-center text-muted-foreground text-sm">No connections configured.</Card>}
      </div>
    </AppLayout>
  );
}
