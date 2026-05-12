import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { ResourcePageShell } from "@/components/resource-page-shell";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { Plus } from "lucide-react";
import { useStationScope } from "@/lib/station-context";

export const Route = createFileRoute("/ads")({ component: AdsPage });

function AdsPage() {
  const qc = useQueryClient();
  const { scope } = useStationScope();
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const [activeFilter, setActiveFilter] = useState<string>("all");
  const [form, setForm] = useState({ advertiser: "", name: "", station_id: "", start_date: "", end_date: "", daily_target: 6 });

  const stations = useQuery({ queryKey: ["stations-list"], queryFn: async () => (await supabase.from("stations").select("id,name").order("name")).data ?? [] });
  const camps = useQuery({
    queryKey: ["ad-campaigns"],
    queryFn: async () => {
      const { data, error } = await supabase.from("ad_campaigns").select("*, stations(name)").order("created_at", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });

  const filtered = useMemo(() => (camps.data ?? []).filter((c: any) => {
    if (scope.kind === "station" && c.station_id !== scope.station.id) return false;
    if (activeFilter === "active" && !c.is_active) return false;
    if (activeFilter === "paused" && c.is_active) return false;
    if (q && !`${c.name} ${c.advertiser}`.toLowerCase().includes(q.toLowerCase())) return false;
    return true;
  }), [camps.data, q, activeFilter, scope]);

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
    onSuccess: () => {
      toast.success("Campaign created");
      setOpen(false);
      setForm({ advertiser: "", name: "", station_id: "", start_date: "", end_date: "", daily_target: 6 });
      qc.invalidateQueries({ queryKey: ["ad-campaigns"] });
    },
    onError: (e: any) => toast.error(e.message),
  });

  const state =
    camps.isLoading ? { kind: "loading" as const } :
    camps.error ? { kind: "error" as const, message: (camps.error as Error).message, retry: () => camps.refetch() } :
    filtered.length === 0 ? { kind: "empty" as const, title: "No ad campaigns", hint: "Create your first campaign to schedule spots." } :
    { kind: "ready" as const };

  const primaryAction = (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild><Button size="sm"><Plus className="w-4 h-4 mr-1" /> New campaign</Button></DialogTrigger>
      <DialogContent>
        <DialogHeader><DialogTitle>New ad campaign</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <div><Label>Advertiser *</Label><Input value={form.advertiser} onChange={(e) => setForm({ ...form, advertiser: e.target.value })} /></div>
          <div><Label>Campaign name *</Label><Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></div>
          <div><Label>Station *</Label>
            <Select value={form.station_id} onValueChange={(v) => setForm({ ...form, station_id: v })}>
              <SelectTrigger><SelectValue placeholder="Station" /></SelectTrigger>
              <SelectContent>{(stations.data ?? []).map((s) => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div><Label>Start</Label><Input type="date" value={form.start_date} onChange={(e) => setForm({ ...form, start_date: e.target.value })} /></div>
            <div><Label>End</Label><Input type="date" value={form.end_date} onChange={(e) => setForm({ ...form, end_date: e.target.value })} /></div>
          </div>
          <div><Label>Daily target spots</Label><Input type="number" min={0} value={form.daily_target} onChange={(e) => setForm({ ...form, daily_target: Number(e.target.value) })} /></div>
        </div>
        <DialogFooter><Button onClick={() => create.mutate()} disabled={create.isPending}>{create.isPending ? "Creating…" : "Create"}</Button></DialogFooter>
      </DialogContent>
    </Dialog>
  );

  return (
    <ResourcePageShell
      title="Ad Campaigns"
      description="Advertiser campaigns and daily spot targets."
      primaryAction={primaryAction}
      searchValue={q}
      onSearchChange={setQ}
      searchPlaceholder="Search campaigns or advertisers…"
      filters={
        <Select value={activeFilter} onValueChange={setActiveFilter}>
          <SelectTrigger className="h-9 w-32"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All</SelectItem>
            <SelectItem value="active">Active</SelectItem>
            <SelectItem value="paused">Paused</SelectItem>
          </SelectContent>
        </Select>
      }
      state={state}
    >
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Campaign</TableHead>
            <TableHead>Advertiser</TableHead>
            <TableHead>Station</TableHead>
            <TableHead>Schedule</TableHead>
            <TableHead className="text-right">Daily</TableHead>
            <TableHead>Status</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {filtered.map((c: any) => (
            <TableRow key={c.id}>
              <TableCell className="font-medium">{c.name}</TableCell>
              <TableCell>{c.advertiser}</TableCell>
              <TableCell className="text-muted-foreground">{c.stations?.name ?? "—"}</TableCell>
              <TableCell className="text-muted-foreground text-xs">{c.start_date ?? "—"} → {c.end_date ?? "—"}</TableCell>
              <TableCell className="tabular-nums text-right">{c.daily_target}</TableCell>
              <TableCell><Badge variant={c.is_active ? "default" : "secondary"} className="uppercase text-[10px]">{c.is_active ? "active" : "paused"}</Badge></TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </ResourcePageShell>
  );
}
