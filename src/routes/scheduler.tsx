import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { database } from "@/services/database";
import { AppLayout } from "@/components/app-layout";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { ConfirmDialog } from "@/components/confirm-dialog";
import { ErrorState } from "@/components/data-states";
import { Plus, Trash2, Mic, Music, Radio, Megaphone, Newspaper, Bell } from "lucide-react";
import { useState } from "react";
import { useAuth } from "@/lib/auth";
import { toast } from "sonner";
import { scheduleBlockSchema, formatZodError, SCHEDULE_BLOCK_KINDS } from "@/lib/validation";

export const Route = createFileRoute("/scheduler")({ component: SchedulerPage });

const DAYS = [
  ["mon","Mon"],["tue","Tue"],["wed","Wed"],["thu","Thu"],
  ["fri","Fri"],["sat","Sat"],["sun","Sun"],
] as const;

type BlockKind = typeof SCHEDULE_BLOCK_KINDS[number];

const KIND_META: Record<BlockKind, { label: string; Icon: typeof Music; classes: string }> = {
  music:   { label: "Music",   Icon: Music,     classes: "bg-secondary/40 border-border" },
  jingle:  { label: "Jingle",  Icon: Bell,      classes: "bg-amber-500/10 border-amber-500/30" },
  ad:      { label: "Ad",      Icon: Megaphone, classes: "bg-orange-500/10 border-orange-500/30" },
  live:    { label: "Live",    Icon: Radio,     classes: "bg-red-500/10 border-red-500/30" },
  news:    { label: "News",    Icon: Newspaper, classes: "bg-blue-500/10 border-blue-500/30" },
  podcast: { label: "Podcast", Icon: Mic,       classes: "bg-primary/10 border-primary/40" },
};

type PodcastSel = { podcast_id: string; mode: "latest" | "specific"; episode_id?: string };

const EMPTY_FORM = {
  name: "",
  day_of_week: "mon",
  start_time: "06:00",
  end_time: "10:00",
  station_id: "",
  block_kind: "music" as BlockKind,
  playlist_id: "",
  rotation_rule_id: "",
  podcast_id: "",
  podcast_mode: "latest" as "latest" | "specific",
  episode_id: "",
};

function SchedulerPage() {
  const qc = useQueryClient();
  const { isEditor } = useAuth();
  const [open, setOpen] = useState(false);
  const [errs, setErrs] = useState<string | null>(null);
  const [form, setForm] = useState(EMPTY_FORM);

  const { data: stations } = useQuery({
    queryKey: ["stations-list"],
    queryFn: async () => (await database.from("stations").select("id,name")).data ?? [],
  });
  const { data: playlists } = useQuery({
    queryKey: ["playlists-list"],
    queryFn: async () => (await database.from("playlists").select("id,name")).data ?? [],
  });
  const { data: rules } = useQuery({
    queryKey: ["rules-list"],
    queryFn: async () => (await database.from("rotation_rules").select("id,name")).data ?? [],
  });
  const { data: podcasts } = useQuery({
    queryKey: ["podcasts-list"],
    queryFn: async () => (await database.from("podcasts").select("id,title").eq("is_active", true).order("title")).data ?? [],
  });
  const { data: episodes } = useQuery({
    queryKey: ["episodes-list", form.podcast_id],
    enabled: !!form.podcast_id && form.podcast_mode === "specific",
    queryFn: async () => (await database
      .from("podcast_episodes")
      .select("id,title,publish_date")
      .eq("podcast_id", form.podcast_id)
      .is("deleted_at", null)
      .order("publish_date", { ascending: false })
      .limit(100)).data ?? [],
  });

  const blocks = useQuery({
    queryKey: ["schedule_blocks"],
    queryFn: async () => {
      const { data, error } = await database
        .from("schedule_blocks")
        .select("*, playlists(name), rotation_rules(name)")
        .order("day_of_week")
        .order("start_time");
      if (error) throw error;
      return data ?? [];
    },
  });

  const podcastIdsInBlocks = Array.from(new Set(
    (blocks.data ?? [])
      .filter((b: any) => b.block_kind === "podcast" && b.podcast_selector?.podcast_id)
      .map((b: any) => b.podcast_selector.podcast_id as string),
  ));
  const { data: podcastLookup } = useQuery({
    queryKey: ["podcasts-lookup", podcastIdsInBlocks.sort().join(",")],
    enabled: podcastIdsInBlocks.length > 0,
    queryFn: async () => {
      const { data } = await database.from("podcasts").select("id,title").in("id", podcastIdsInBlocks);
      const map: Record<string, string> = {};
      (data ?? []).forEach((p: any) => { map[p.id] = p.title; });
      return map;
    },
  });

  const resetForm = () => { setForm(EMPTY_FORM); setErrs(null); };

  const create = useMutation({
    mutationFn: async () => {
      const podcast_selector: PodcastSel | null = form.block_kind === "podcast"
        ? { podcast_id: form.podcast_id, mode: form.podcast_mode, episode_id: form.episode_id || undefined }
        : null;

      const parsed = scheduleBlockSchema.safeParse({
        name: form.name,
        station_id: form.station_id,
        day_of_week: form.day_of_week,
        start_time: form.start_time,
        end_time: form.end_time,
        block_kind: form.block_kind,
        playlist_id: form.block_kind === "music" ? form.playlist_id : "",
        rotation_rule_id: form.block_kind === "music" ? form.rotation_rule_id : "",
        podcast_selector,
      });
      if (!parsed.success) {
        const m = formatZodError(parsed.error);
        setErrs(m);
        throw new Error(m);
      }
      setErrs(null);
      const d = parsed.data;
      const payload: any = {
        name: d.name,
        station_id: d.station_id,
        day_of_week: d.day_of_week,
        start_time: d.start_time,
        end_time: d.end_time,
        block_kind: d.block_kind,
        playlist_id: d.playlist_id || null,
        rotation_rule_id: d.rotation_rule_id || null,
        podcast_selector: d.podcast_selector ?? null,
      };
      const { error } = await database.from("schedule_blocks").insert(payload);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Block added");
      setOpen(false);
      resetForm();
      qc.invalidateQueries({ queryKey: ["schedule_blocks"] });
    },
    onError: (e: any) => toast.error(e.message),
  });

  const del = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await database.from("schedule_blocks").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Deleted");
      qc.invalidateQueries({ queryKey: ["schedule_blocks"] });
    },
    onError: (e: any) => toast.error(e.message),
  });

  const byDay: Record<string, any[]> = {};
  DAYS.forEach(([d]) => (byDay[d] = []));
  blocks.data?.forEach((b: any) => byDay[b.day_of_week]?.push(b));

  return (
    <AppLayout
      title="Scheduler"
      description="Weekly programming blocks across stations."
      actions={
        isEditor && (
          <Dialog open={open} onOpenChange={(v) => { setOpen(v); if (!v) resetForm(); }}>
            <DialogTrigger asChild>
              <Button size="sm"><Plus className="w-4 h-4 mr-1" />New Block</Button>
            </DialogTrigger>
            <DialogContent className="max-w-lg">
              <DialogHeader><DialogTitle>New schedule block</DialogTitle></DialogHeader>
              <div className="space-y-3">
                <div>
                  <Label>Kind *</Label>
                  <Select value={form.block_kind} onValueChange={(v) => setForm({ ...form, block_kind: v as BlockKind })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {SCHEDULE_BLOCK_KINDS.map((k) => (
                        <SelectItem key={k} value={k}>{KIND_META[k].label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Name *</Label>
                  <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Morning Drive" />
                </div>
                <div>
                  <Label>Station *</Label>
                  <Select value={form.station_id} onValueChange={(v) => setForm({ ...form, station_id: v })}>
                    <SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger>
                    <SelectContent>
                      {stations?.map((s) => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div className="grid grid-cols-3 gap-3">
                  <div>
                    <Label>Day</Label>
                    <Select value={form.day_of_week} onValueChange={(v) => setForm({ ...form, day_of_week: v })}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {DAYS.map(([k, l]) => <SelectItem key={k} value={k}>{l}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                  <div><Label>Start</Label><Input type="time" value={form.start_time} onChange={(e) => setForm({ ...form, start_time: e.target.value })} /></div>
                  <div><Label>End</Label><Input type="time" value={form.end_time} onChange={(e) => setForm({ ...form, end_time: e.target.value })} /></div>
                </div>

                {form.block_kind === "music" && (
                  <>
                    <div>
                      <Label>Playlist</Label>
                      <Select value={form.playlist_id} onValueChange={(v) => setForm({ ...form, playlist_id: v })}>
                        <SelectTrigger><SelectValue placeholder="Optional" /></SelectTrigger>
                        <SelectContent>
                          {playlists?.map((p) => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <Label>Rotation rule</Label>
                      <Select value={form.rotation_rule_id} onValueChange={(v) => setForm({ ...form, rotation_rule_id: v })}>
                        <SelectTrigger><SelectValue placeholder="Optional" /></SelectTrigger>
                        <SelectContent>
                          {rules?.map((r) => <SelectItem key={r.id} value={r.id}>{r.name}</SelectItem>)}
                        </SelectContent>
                      </Select>
                    </div>
                  </>
                )}

                {form.block_kind === "podcast" && (
                  <div className="space-y-3 rounded-md border border-primary/30 bg-primary/5 p-3">
                    <div>
                      <Label>Podcast *</Label>
                      <Select value={form.podcast_id} onValueChange={(v) => setForm({ ...form, podcast_id: v, episode_id: "" })}>
                        <SelectTrigger><SelectValue placeholder="Select podcast" /></SelectTrigger>
                        <SelectContent>
                          {podcasts?.length
                            ? podcasts.map((p: any) => <SelectItem key={p.id} value={p.id}>{p.title}</SelectItem>)
                            : <div className="px-2 py-1.5 text-xs text-muted-foreground">No active podcasts — sync from Podcast Hub first.</div>}
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <Label>Episode strategy</Label>
                      <Select value={form.podcast_mode} onValueChange={(v) => setForm({ ...form, podcast_mode: v as "latest" | "specific", episode_id: "" })}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="latest">Always latest episode</SelectItem>
                          <SelectItem value="specific">Pin a specific episode</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    {form.podcast_mode === "specific" && (
                      <div>
                        <Label>Episode *</Label>
                        <Select value={form.episode_id} onValueChange={(v) => setForm({ ...form, episode_id: v })} disabled={!form.podcast_id}>
                          <SelectTrigger><SelectValue placeholder={form.podcast_id ? "Select episode" : "Pick a podcast first"} /></SelectTrigger>
                          <SelectContent>
                            {episodes?.map((e: any) => (
                              <SelectItem key={e.id} value={e.id}>
                                {e.title}{e.publish_date ? ` — ${new Date(e.publish_date).toLocaleDateString()}` : ""}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    )}
                  </div>
                )}

                {errs && <p className="text-xs text-destructive whitespace-pre-line">{errs}</p>}
              </div>
              <DialogFooter>
                <Button onClick={() => create.mutate()} disabled={create.isPending}>
                  {create.isPending ? "Creating…" : "Create"}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        )
      }
    >
      {blocks.error && <ErrorState error={blocks.error} onRetry={() => blocks.refetch()} />}
      <div className="grid grid-cols-1 md:grid-cols-7 gap-3">
        {DAYS.map(([key, label]) => (
          <Card key={key} className="p-3">
            <div className="text-xs uppercase tracking-wider text-muted-foreground font-semibold mb-3">{label}</div>
            <div className="space-y-2 min-h-[120px]">
              {byDay[key]?.length ? byDay[key].map((b: any) => {
                const kind = (b.block_kind ?? "music") as BlockKind;
                const meta = KIND_META[kind] ?? KIND_META.music;
                const KindIcon = meta.Icon;
                const podcastTitle = kind === "podcast" && b.podcast_selector?.podcast_id
                  ? podcastLookup?.[b.podcast_selector.podcast_id]
                  : null;
                return (
                  <div key={b.id} className={`rounded border p-2 text-xs group relative ${meta.classes}`}>
                    <div className="flex items-center gap-1.5 mb-0.5">
                      <KindIcon className="w-3 h-3 shrink-0" />
                      <span className="font-semibold truncate">{b.name}</span>
                    </div>
                    <div className="text-muted-foreground tabular-nums">
                      {b.start_time?.slice(0,5)}–{b.end_time?.slice(0,5)}
                    </div>
                    {kind === "podcast" ? (
                      <div className="mt-1 space-y-0.5">
                        <div className="text-muted-foreground truncate">🎙 {podcastTitle ?? "…"}</div>
                        <Badge variant="outline" className="text-[10px] px-1 py-0 h-4">
                          {b.podcast_selector?.mode === "specific" ? "pinned episode" : "latest episode"}
                        </Badge>
                      </div>
                    ) : (
                      <>
                        {b.playlists?.name && <div className="text-muted-foreground mt-1">▸ {b.playlists.name}</div>}
                        {b.rotation_rules?.name && <div className="text-muted-foreground">⟳ {b.rotation_rules.name}</div>}
                      </>
                    )}
                    {isEditor && (
                      <div className="absolute top-1 right-1 opacity-0 group-hover:opacity-100">
                        <ConfirmDialog
                          title={`Delete block "${b.name}"?`}
                          confirmText="Delete" destructive
                          onConfirm={() => del.mutateAsync(b.id)}
                          trigger={<button className="text-destructive"><Trash2 className="w-3 h-3" /></button>}
                        />
                      </div>
                    )}
                  </div>
                );
              }) : <div className="text-xs text-muted-foreground italic">No blocks</div>}
            </div>
          </Card>
        ))}
      </div>
    </AppLayout>
  );
}
