import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { AppLayout } from "@/components/app-layout";
import { Card } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { StatusBadge } from "@/components/status-badge";
import { Plus, Trash2 } from "lucide-react";
import { useState } from "react";
import { useAuth } from "@/lib/auth";
import { toast } from "sonner";

export const Route = createFileRoute("/stations")({ component: StationsPage });

function StationsPage() {
  const qc = useQueryClient();
  const { isEditor, isAdmin } = useAuth();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ name: "", slug: "", description: "", account_id: "", azuracast_station_id: "", is_active: true });

  const { data: accounts } = useQuery({ queryKey: ["accounts-list"], queryFn: async () => (await supabase.from("accounts").select("id,name").order("name")).data ?? [] });
  const { data, isLoading } = useQuery({
    queryKey: ["stations"],
    queryFn: async () => (await supabase.from("stations").select("*, accounts(name)").order("name")).data ?? [],
  });

  const create = useMutation({
    mutationFn: async () => {
      const payload = { ...form, account_id: form.account_id || null, azuracast_station_id: form.azuracast_station_id || null };
      const { error } = await supabase.from("stations").insert(payload);
      if (error) throw error;
    },
    onSuccess: () => { toast.success("Station created"); setOpen(false); qc.invalidateQueries({ queryKey:["stations"] }); },
    onError: (e: any) => toast.error(e.message),
  });
  const toggle = useMutation({
    mutationFn: async ({ id, val }: { id: string; val: boolean }) => { const { error } = await supabase.from("stations").update({ is_active: val }).eq("id", id); if (error) throw error; },
    onSuccess: () => qc.invalidateQueries({ queryKey:["stations"] }),
    onError: (e: any) => toast.error(e.message),
  });
  const del = useMutation({
    mutationFn: async (id: string) => { const { error } = await supabase.from("stations").delete().eq("id", id); if (error) throw error; },
    onSuccess: () => { toast.success("Deleted"); qc.invalidateQueries({ queryKey:["stations"] }); },
    onError: (e: any) => toast.error(e.message),
  });

  return (
    <AppLayout title="Stations" description="Broadcast stations linked to AzuraCast." actions={
      isEditor && (
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild><Button size="sm"><Plus className="w-4 h-4 mr-1" />New Station</Button></DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>New station</DialogTitle></DialogHeader>
            <div className="space-y-3">
              <div><Label>Name</Label><Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></div>
              <div><Label>Slug</Label><Input value={form.slug} onChange={(e) => setForm({ ...form, slug: e.target.value.toLowerCase().replace(/\s+/g,'-') })} /></div>
              <div><Label>Account</Label>
                <Select value={form.account_id} onValueChange={(v) => setForm({ ...form, account_id: v })}>
                  <SelectTrigger><SelectValue placeholder="Select account" /></SelectTrigger>
                  <SelectContent>{accounts?.map((a) => <SelectItem key={a.id} value={a.id}>{a.name}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div><Label>AzuraCast Station ID</Label><Input value={form.azuracast_station_id} onChange={(e) => setForm({ ...form, azuracast_station_id: e.target.value })} /></div>
              <div><Label>Description</Label><Textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} /></div>
            </div>
            <DialogFooter><Button onClick={() => create.mutate()} disabled={!form.name || !form.slug || create.isPending}>Create</Button></DialogFooter>
          </DialogContent>
        </Dialog>
      )
    }>
      <Card className="overflow-hidden">
        <Table>
          <TableHeader><TableRow><TableHead>Name</TableHead><TableHead>Slug</TableHead><TableHead>Account</TableHead><TableHead>AzuraCast ID</TableHead><TableHead>Status</TableHead><TableHead>Active</TableHead><TableHead className="w-12" /></TableRow></TableHeader>
          <TableBody>
            {isLoading && <TableRow><TableCell colSpan={7} className="text-center text-muted-foreground py-8">Loading…</TableCell></TableRow>}
            {data?.map((s: any) => (
              <TableRow key={s.id}>
                <TableCell className="font-medium">{s.name}</TableCell>
                <TableCell className="text-muted-foreground font-mono text-xs">{s.slug}</TableCell>
                <TableCell className="text-muted-foreground">{s.accounts?.name ?? "—"}</TableCell>
                <TableCell className="text-muted-foreground font-mono text-xs">{s.azuracast_station_id ?? "—"}</TableCell>
                <TableCell><StatusBadge status={s.azuracast_station_id ? "ok" : "untested"} /></TableCell>
                <TableCell><Switch checked={s.is_active} disabled={!isEditor} onCheckedChange={(v) => toggle.mutate({ id: s.id, val: v })} /></TableCell>
                <TableCell>{isAdmin && <Button variant="ghost" size="icon" onClick={() => confirm(`Delete ${s.name}?`) && del.mutate(s.id)}><Trash2 className="w-4 h-4" /></Button>}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Card>
    </AppLayout>
  );
}
