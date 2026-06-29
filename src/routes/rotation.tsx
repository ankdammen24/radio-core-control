import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { database } from "@/services/database";
import { AppLayout } from "@/components/app-layout";
import { Card } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { ConfirmDialog } from "@/components/confirm-dialog";
import { EmptyState, ErrorState, LoadingRows } from "@/components/data-states";
import { Plus, Trash2, Repeat } from "lucide-react";
import { useState } from "react";
import { useAuth } from "@/lib/auth";
import { toast } from "sonner";
import { rotationRuleSchema, formatZodError } from "@/lib/validation";

export const Route = createFileRoute("/rotation")({ component: RotationPage });

const CATEGORIES = ["heavy","medium","light","local","ai","news","jingle","sweeper","promo","podcast"] as const;

function RotationPage() {
  const qc = useQueryClient();
  const { isEditor } = useAuth();
  const [open, setOpen] = useState(false);
  const [errs, setErrs] = useState<string | null>(null);
  const [form, setForm] = useState({ name:"", description:"", category:"heavy", min_minutes_between_same_artist:30, min_minutes_between_same_track:120, max_tracks_per_hour:12, priority:5, station_id:"" });

  const { data: stations } = useQuery({ queryKey:["stations-list"], queryFn: async () => (await database.from("stations").select("id,name")).data ?? [] });
  const rules = useQuery({
    queryKey:["rotation_rules"],
    queryFn: async () => {
      const { data, error } = await database.from("rotation_rules").select("*, stations(name)").order("priority", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });

  const create = useMutation({
    mutationFn: async () => {
      const parsed = rotationRuleSchema.safeParse(form);
      if (!parsed.success) { const m = formatZodError(parsed.error); setErrs(m); throw new Error(m); }
      setErrs(null);
      const { error } = await database.from("rotation_rules").insert(parsed.data as any);
      if (error) throw error;
    },
    onSuccess: () => { toast.success("Rule created"); setOpen(false); qc.invalidateQueries({ queryKey:["rotation_rules"] }); },
    onError: (e: any) => toast.error(e.message),
  });
  const toggle = useMutation({
    mutationFn: async ({ id, val }: { id: string; val: boolean }) => { const { error } = await database.from("rotation_rules").update({ is_active: val }).eq("id", id); if (error) throw error; },
    onSuccess: () => qc.invalidateQueries({ queryKey:["rotation_rules"] }),
  });
  const del = useMutation({
    mutationFn: async (id: string) => { const { error } = await database.from("rotation_rules").delete().eq("id", id); if (error) throw error; },
    onSuccess: () => { toast.success("Deleted"); qc.invalidateQueries({ queryKey:["rotation_rules"] }); },
    onError: (e: any) => toast.error(e.message),
  });

  return (
    <AppLayout title="Rotation Rules" description="Separation, repetition limits and priority for rotation categories." actions={
      isEditor && (
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild><Button size="sm"><Plus className="w-4 h-4 mr-1" />New Rule</Button></DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>New rotation rule</DialogTitle></DialogHeader>
            <div className="space-y-3">
              <div><Label>Name *</Label><Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></div>
              <div><Label>Station *</Label>
                <Select value={form.station_id} onValueChange={(v) => setForm({ ...form, station_id: v })}>
                  <SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger>
                  <SelectContent>{stations?.map((s) => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div><Label>Category</Label>
                <Select value={form.category} onValueChange={(v) => setForm({ ...form, category: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{CATEGORIES.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div><Label>Min min same artist</Label><Input type="number" value={form.min_minutes_between_same_artist} onChange={(e) => setForm({ ...form, min_minutes_between_same_artist: Number(e.target.value) })} /></div>
                <div><Label>Min min same track</Label><Input type="number" value={form.min_minutes_between_same_track} onChange={(e) => setForm({ ...form, min_minutes_between_same_track: Number(e.target.value) })} /></div>
                <div><Label>Max tracks/hour</Label><Input type="number" value={form.max_tracks_per_hour} onChange={(e) => setForm({ ...form, max_tracks_per_hour: Number(e.target.value) })} /></div>
                <div><Label>Priority</Label><Input type="number" value={form.priority} onChange={(e) => setForm({ ...form, priority: Number(e.target.value) })} /></div>
              </div>
              <div><Label>Description</Label><Input value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} /></div>
              {errs && <p className="text-xs text-destructive">{errs}</p>}
            </div>
            <DialogFooter><Button onClick={() => create.mutate()} disabled={create.isPending}>{create.isPending ? "Creating…" : "Create"}</Button></DialogFooter>
          </DialogContent>
        </Dialog>
      )
    }>
      {rules.error && <ErrorState error={rules.error} onRetry={() => rules.refetch()} />}
      {!rules.error && (
        <Card className="overflow-hidden">
          {rules.isLoading ? <LoadingRows cols={9} /> : (
            <Table>
              <TableHeader><TableRow><TableHead>Name</TableHead><TableHead>Category</TableHead><TableHead>Station</TableHead><TableHead>Artist sep.</TableHead><TableHead>Track sep.</TableHead><TableHead>Max/hr</TableHead><TableHead>Priority</TableHead><TableHead>Active</TableHead><TableHead className="w-12" /></TableRow></TableHeader>
              <TableBody>
                {rules.data?.map((r: any) => (
                  <TableRow key={r.id}>
                    <TableCell className="font-medium">{r.name}</TableCell>
                    <TableCell><Badge variant="outline" className="uppercase text-[10px]">{r.category}</Badge></TableCell>
                    <TableCell className="text-muted-foreground">{r.stations?.name}</TableCell>
                    <TableCell className="tabular-nums">{r.min_minutes_between_same_artist}m</TableCell>
                    <TableCell className="tabular-nums">{r.min_minutes_between_same_track}m</TableCell>
                    <TableCell className="tabular-nums">{r.max_tracks_per_hour}</TableCell>
                    <TableCell className="tabular-nums">{r.priority}</TableCell>
                    <TableCell><Switch checked={r.is_active} disabled={!isEditor} onCheckedChange={(v) => toggle.mutate({ id: r.id, val: v })} /></TableCell>
                    <TableCell>
                      {isEditor && (
                        <ConfirmDialog
                          title={`Delete rule "${r.name}"?`}
                          confirmText="Delete" destructive
                          onConfirm={() => del.mutateAsync(r.id)}
                          trigger={<Button variant="ghost" size="icon"><Trash2 className="w-4 h-4" /></Button>}
                        />
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
          {!rules.isLoading && !rules.data?.length && (
            <div className="p-6"><EmptyState icon={Repeat} title="No rotation rules" description="Define artist/track separation and per-hour caps." /></div>
          )}
        </Card>
      )}
    </AppLayout>
  );
}
