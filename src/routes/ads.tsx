import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { AppLayout } from "@/components/app-layout";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { EmptyState } from "@/components/data-states";
import { Badge } from "@/components/ui/badge";
import { useState } from "react";
import { toast } from "sonner";
import { Megaphone, Plus } from "lucide-react";

export const Route = createFileRoute("/ads")({ component: AdsPage });

function AdsPage() {
  const qc = useQueryClient();
  const [form, setForm] = useState({ advertiser: "", name: "", station_id: "", start_date: "", end_date: "", daily_target: 6 });

  const stations = useQuery({ queryKey: ["stations-list"], queryFn: async () => (await supabase.from("stations").select("id,name").order("name")).data ?? [] });
  const camps = useQuery({
    queryKey: ["ad-campaigns"],
    queryFn: async () => (await supabase.from("ad_campaigns").select("*, stations(name)").order("created_at", { ascending: false })).data ?? [],
  });

  const create = useMutation({
    mutationFn: async () => {
      if (!form.advertiser || !form.name || !form.station_id) throw new Error("Advertiser, name and station required");
      const { error } = await supabase.from("ad_campaigns").insert({
        advertiser: form.advertiser, name: form.name, station_id: form.station_id,
        start_date: form.start_date || null, end_date: form.end_date || null,
        daily_target: form.daily_target,
      });
      if (error) throw error;
    },
    onSuccess: () => { toast.success("Campaign created"); setForm({ advertiser: "", name: "", station_id: "", start_date: "", end_date: "", daily_target: 6 }); qc.invalidateQueries({ queryKey: ["ad-campaigns"] }); },
    onError: (e: any) => toast.error(e.message),
  });

  return (
    <AppLayout title="Ad Campaigns" description="Reklamkampanjer, jinglar och spots">
      <Card className="p-4 mb-4">
        <h2 className="text-sm font-semibold mb-3 flex items-center gap-2"><Megaphone className="w-4 h-4" /> New campaign</h2>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-2 mb-3">
          <Input placeholder="Advertiser" value={form.advertiser} onChange={(e) => setForm({ ...form, advertiser: e.target.value })} />
          <Input placeholder="Campaign name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
          <Select value={form.station_id} onValueChange={(v) => setForm({ ...form, station_id: v })}>
            <SelectTrigger><SelectValue placeholder="Station" /></SelectTrigger>
            <SelectContent>{(stations.data ?? []).map((s) => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}</SelectContent>
          </Select>
          <Input type="date" value={form.start_date} onChange={(e) => setForm({ ...form, start_date: e.target.value })} />
          <Input type="date" value={form.end_date} onChange={(e) => setForm({ ...form, end_date: e.target.value })} />
          <Input type="number" min={0} placeholder="Daily target spots" value={form.daily_target} onChange={(e) => setForm({ ...form, daily_target: Number(e.target.value) })} />
        </div>
        <Button onClick={() => create.mutate()}><Plus className="w-4 h-4 mr-2" /> Create</Button>
      </Card>

      <Card className="p-4">
        <h2 className="text-sm font-semibold mb-3">Campaigns</h2>
        <div className="divide-y divide-border">
          {(camps.data ?? []).length === 0 && <EmptyState title="No campaigns yet" />}
          {(camps.data ?? []).map((c: any) => (
            <div key={c.id} className="py-3 flex items-center justify-between">
              <div>
                <div className="font-medium">{c.name} <span className="text-muted-foreground">— {c.advertiser}</span></div>
                <div className="text-xs text-muted-foreground">{c.stations?.name} · {c.start_date ?? "—"} → {c.end_date ?? "—"} · {c.daily_target}/day</div>
              </div>
              <Badge variant={c.is_active ? "default" : "secondary"}>{c.is_active ? "active" : "paused"}</Badge>
            </div>
          ))}
        </div>
      </Card>
    </AppLayout>
  );
}
