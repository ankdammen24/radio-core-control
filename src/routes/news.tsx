import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { toast } from "sonner";
import { AppLayout } from "@/components/app-layout";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Plus, Trash2, Radio, AudioLines, Clock, Calendar, Tag, History } from "lucide-react";
import {
  listNews, upsertNewsItem, setNewsStatus, deleteNewsItem, getNewsBroadcastHistory,
} from "@/lib/news.functions";

export const Route = createFileRoute("/news")({ component: NewsPage });

const STATUSES = ["draft", "processing", "ready_for_radio", "broadcasted", "archived", "expired"] as const;
const PRIORITIES = ["low", "normal", "high", "breaking"] as const;
type Status = typeof STATUSES[number];
type Priority = typeof PRIORITIES[number];

const statusVariant: Record<Status, string> = {
  draft: "bg-muted text-muted-foreground",
  processing: "bg-blue-500/15 text-blue-400",
  ready_for_radio: "bg-emerald-500/15 text-emerald-400",
  broadcasted: "bg-violet-500/15 text-violet-400",
  archived: "bg-zinc-500/15 text-zinc-400",
  expired: "bg-red-500/15 text-red-400",
};

const blank = {
  id: undefined as string | undefined,
  title: "",
  short_title: "",
  summary: "",
  full_article: "",
  radio_script: "",
  region: "",
  municipality: "",
  category: "",
  priority: "normal" as Priority,
  language: "sv",
  source: "",
  tags: "",
  estimated_duration_seconds: "" as string | number,
  audio_url: "",
  image_url: "",
  status: "draft" as Status,
  external_id: "",
  published_at: "",
  expires_at: "",
};

function NewsPage() {
  const qc = useQueryClient();
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [editing, setEditing] = useState<typeof blank | null>(null);
  const [detailId, setDetailId] = useState<string | null>(null);

  const listFn = useServerFn(listNews);
  const upsertFn = useServerFn(upsertNewsItem);
  const setStatusFn = useServerFn(setNewsStatus);
  const deleteFn = useServerFn(deleteNewsItem);

  const items = useQuery({
    queryKey: ["news", statusFilter],
    queryFn: () => listFn({ data: statusFilter === "all" ? {} : { status: statusFilter } }),
  });

  const save = useMutation({
    mutationFn: async (form: typeof blank) => {
      const payload = {
        ...(form.id ? { id: form.id } : {}),
        title: form.title.trim(),
        short_title: form.short_title || null,
        summary: form.summary || null,
        full_article: form.full_article || null,
        radio_script: form.radio_script || null,
        region: form.region || null,
        municipality: form.municipality || null,
        category: form.category || null,
        priority: form.priority,
        language: form.language || "sv",
        source: form.source || null,
        tags: form.tags ? form.tags.split(",").map((t) => t.trim()).filter(Boolean) : [],
        estimated_duration_seconds: form.estimated_duration_seconds === "" ? null : Number(form.estimated_duration_seconds),
        audio_url: form.audio_url || null,
        image_url: form.image_url || null,
        status: form.status,
        external_id: form.external_id || null,
        published_at: form.published_at ? new Date(form.published_at).toISOString() : null,
        expires_at: form.expires_at ? new Date(form.expires_at).toISOString() : null,
      };
      return upsertFn({ data: payload });
    },
    onSuccess: () => {
      toast.success("Saved");
      setEditing(null);
      qc.invalidateQueries({ queryKey: ["news"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const changeStatus = useMutation({
    mutationFn: ({ id, status }: { id: string; status: Status }) => setStatusFn({ data: { id, status } }),
    onSuccess: () => {
      toast.success("Status updated");
      qc.invalidateQueries({ queryKey: ["news"] });
    },
  });

  const remove = useMutation({
    mutationFn: (id: string) => deleteFn({ data: { id } }),
    onSuccess: () => {
      toast.success("Deleted");
      qc.invalidateQueries({ queryKey: ["news"] });
    },
  });

  return (
    <AppLayout>
      <div className="p-6 space-y-6">
        <div className="flex items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-semibold">News</h1>
            <p className="text-sm text-muted-foreground">
              Broadcast-ready stories. Only <Badge variant="outline">ready_for_radio</Badge> items are exposed to stations via the Radio Core API.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-44"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All statuses</SelectItem>
                {STATUSES.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
              </SelectContent>
            </Select>
            <Button onClick={() => setEditing({ ...blank })}><Plus className="h-4 w-4 mr-1" /> New</Button>
          </div>
        </div>

        <Card className="overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Title</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Priority</TableHead>
                <TableHead>Region</TableHead>
                <TableHead>Audio</TableHead>
                <TableHead>Expires</TableHead>
                <TableHead className="w-32" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {items.isLoading && <TableRow><TableCell colSpan={7}>Loading…</TableCell></TableRow>}
              {items.data?.length === 0 && <TableRow><TableCell colSpan={7} className="text-muted-foreground">No news items.</TableCell></TableRow>}
              {items.data?.map((n) => (
                <TableRow key={n.id} className="cursor-pointer" onClick={() => setDetailId(n.id)}>
                  <TableCell className="font-medium">{n.title}</TableCell>
                  <TableCell><span className={`px-2 py-0.5 rounded text-xs ${statusVariant[n.status as Status]}`}>{n.status}</span></TableCell>
                  <TableCell>{n.priority}</TableCell>
                  <TableCell>{n.region ?? "—"}</TableCell>
                  <TableCell>{n.audio_url ? <AudioLines className="h-4 w-4 text-emerald-400" /> : <span className="text-muted-foreground text-xs">pending</span>}</TableCell>
                  <TableCell className="text-xs text-muted-foreground">{n.expires_at ? new Date(n.expires_at).toLocaleString() : "—"}</TableCell>
                  <TableCell onClick={(e) => e.stopPropagation()}>
                    <div className="flex gap-1 justify-end">
                      <Button size="sm" variant="ghost" onClick={() => setEditing({
                        ...blank, ...n,
                        short_title: n.short_title ?? "", summary: n.summary ?? "", full_article: n.full_article ?? "",
                        radio_script: n.radio_script ?? "", region: n.region ?? "", municipality: n.municipality ?? "",
                        category: n.category ?? "", source: n.source ?? "", external_id: n.external_id ?? "",
                        audio_url: n.audio_url ?? "", image_url: n.image_url ?? "",
                        tags: (n.tags ?? []).join(", "),
                        estimated_duration_seconds: n.estimated_duration_seconds ?? "",
                        published_at: n.published_at ? new Date(n.published_at).toISOString().slice(0, 16) : "",
                        expires_at: n.expires_at ? new Date(n.expires_at).toISOString().slice(0, 16) : "",
                      })}>Edit</Button>
                      <Button size="sm" variant="ghost" onClick={() => {
                        if (confirm("Delete this news item?")) remove.mutate(n.id);
                      }}><Trash2 className="h-4 w-4" /></Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Card>
      </div>

      {editing && (
        <NewsEditor
          value={editing}
          onChange={setEditing}
          onClose={() => setEditing(null)}
          onSave={() => save.mutate(editing)}
          saving={save.isPending}
        />
      )}

      {detailId && (
        <NewsDetail
          id={detailId}
          onClose={() => setDetailId(null)}
          onStatus={(status) => changeStatus.mutate({ id: detailId, status })}
        />
      )}
    </AppLayout>
  );
}

function NewsEditor({ value, onChange, onClose, onSave, saving }: {
  value: typeof blank;
  onChange: (v: typeof blank) => void;
  onClose: () => void;
  onSave: () => void;
  saving: boolean;
}) {
  const set = <K extends keyof typeof blank>(k: K, v: (typeof blank)[K]) => onChange({ ...value, [k]: v });
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader><DialogTitle>{value.id ? "Edit news item" : "New news item"}</DialogTitle></DialogHeader>
        <div className="grid grid-cols-2 gap-4">
          <div className="col-span-2">
            <Label>Title *</Label>
            <Input value={value.title} onChange={(e) => set("title", e.target.value)} />
          </div>
          <div>
            <Label>Short title</Label>
            <Input value={value.short_title} onChange={(e) => set("short_title", e.target.value)} />
          </div>
          <div>
            <Label>Source</Label>
            <Input value={value.source} onChange={(e) => set("source", e.target.value)} />
          </div>
          <div className="col-span-2">
            <Label>Summary</Label>
            <Textarea rows={2} value={value.summary} onChange={(e) => set("summary", e.target.value)} />
          </div>
          <div className="col-span-2">
            <Label>Radio script</Label>
            <Textarea rows={4} value={value.radio_script} onChange={(e) => set("radio_script", e.target.value)} />
          </div>
          <div className="col-span-2">
            <Label>Full article</Label>
            <Textarea rows={4} value={value.full_article} onChange={(e) => set("full_article", e.target.value)} />
          </div>
          <div><Label>Region</Label><Input value={value.region} onChange={(e) => set("region", e.target.value)} /></div>
          <div><Label>Municipality</Label><Input value={value.municipality} onChange={(e) => set("municipality", e.target.value)} /></div>
          <div><Label>Category</Label><Input value={value.category} onChange={(e) => set("category", e.target.value)} /></div>
          <div><Label>Language</Label><Input value={value.language} onChange={(e) => set("language", e.target.value)} /></div>
          <div>
            <Label>Priority</Label>
            <Select value={value.priority} onValueChange={(v) => set("priority", v as Priority)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>{PRIORITIES.map((p) => <SelectItem key={p} value={p}>{p}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div>
            <Label>Status</Label>
            <Select value={value.status} onValueChange={(v) => set("status", v as Status)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>{STATUSES.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div><Label>Duration (s)</Label><Input type="number" value={value.estimated_duration_seconds} onChange={(e) => set("estimated_duration_seconds", e.target.value)} /></div>
          <div><Label>External ID</Label><Input value={value.external_id} onChange={(e) => set("external_id", e.target.value)} /></div>
          <div className="col-span-2"><Label>Tags (comma-separated)</Label><Input value={value.tags} onChange={(e) => set("tags", e.target.value)} /></div>
          <div><Label>Audio URL</Label><Input value={value.audio_url} onChange={(e) => set("audio_url", e.target.value)} /></div>
          <div><Label>Image URL</Label><Input value={value.image_url} onChange={(e) => set("image_url", e.target.value)} /></div>
          <div><Label>Published at</Label><Input type="datetime-local" value={value.published_at} onChange={(e) => set("published_at", e.target.value)} /></div>
          <div><Label>Expires at</Label><Input type="datetime-local" value={value.expires_at} onChange={(e) => set("expires_at", e.target.value)} /></div>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={onClose}>Cancel</Button>
          <Button onClick={onSave} disabled={saving || !value.title.trim()}>{saving ? "Saving…" : "Save"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function NewsDetail({ id, onClose, onStatus }: {
  id: string;
  onClose: () => void;
  onStatus: (s: Status) => void;
}) {
  const listFn = useServerFn(listNews);
  const historyFn = useServerFn(getNewsBroadcastHistory);

  const item = useQuery({
    queryKey: ["news-detail", id],
    queryFn: async () => {
      const all = await listFn({ data: {} });
      return all.find((n) => n.id === id) ?? null;
    },
  });
  const history = useQuery({
    queryKey: ["news-history", id],
    queryFn: () => historyFn({ data: { newsItemId: id } }),
  });

  const n = item.data;
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader><DialogTitle>{n?.title ?? "Loading…"}</DialogTitle></DialogHeader>
        {n && (
          <Tabs defaultValue="overview">
            <TabsList>
              <TabsTrigger value="overview">Overview</TabsTrigger>
              <TabsTrigger value="radio"><Radio className="h-3.5 w-3.5 mr-1" /> Radio</TabsTrigger>
              <TabsTrigger value="script">Script & Article</TabsTrigger>
            </TabsList>

            <TabsContent value="overview" className="space-y-2 text-sm">
              <div><span className="text-muted-foreground">Status:</span> <span className={`px-2 py-0.5 rounded text-xs ${statusVariant[n.status as Status]}`}>{n.status}</span></div>
              <div><span className="text-muted-foreground">Priority:</span> {n.priority}</div>
              <div><span className="text-muted-foreground">Region/Mun:</span> {n.region ?? "—"} / {n.municipality ?? "—"}</div>
              <div><span className="text-muted-foreground">Category:</span> {n.category ?? "—"}</div>
              <div><span className="text-muted-foreground">Source:</span> {n.source ?? "—"}</div>
              <div><span className="text-muted-foreground">Tags:</span> {(n.tags ?? []).join(", ") || "—"}</div>
              {n.summary && <p className="pt-2">{n.summary}</p>}
            </TabsContent>

            <TabsContent value="radio" className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <Card className="p-4">
                  <div className="text-xs text-muted-foreground">Ready for Radio</div>
                  <div className="mt-1 font-semibold">
                    {n.status === "ready_for_radio" || n.status === "broadcasted"
                      ? <Badge className="bg-emerald-500/15 text-emerald-400 border-emerald-500/30">Yes — exposed via API</Badge>
                      : <Badge variant="outline">No — status is {n.status}</Badge>}
                  </div>
                  <div className="mt-3 flex gap-2">
                    {n.status !== "ready_for_radio" && (
                      <Button size="sm" onClick={() => onStatus("ready_for_radio")}>Mark Ready</Button>
                    )}
                    {n.status === "ready_for_radio" && (
                      <Button size="sm" variant="outline" onClick={() => onStatus("archived")}>Archive</Button>
                    )}
                  </div>
                </Card>

                <Card className="p-4">
                  <div className="text-xs text-muted-foreground flex items-center gap-1"><AudioLines className="h-3 w-3" /> Audio</div>
                  <div className="mt-1 font-semibold">
                    {n.audio_url
                      ? <Badge className="bg-emerald-500/15 text-emerald-400">Available</Badge>
                      : <Badge className="bg-amber-500/15 text-amber-400">Pending</Badge>}
                  </div>
                  {n.audio_url && (
                    <audio controls src={n.audio_url} className="mt-2 w-full" />
                  )}
                </Card>

                <Card className="p-4">
                  <div className="text-xs text-muted-foreground flex items-center gap-1"><Clock className="h-3 w-3" /> Estimated duration</div>
                  <div className="mt-1 font-semibold">
                    {n.estimated_duration_seconds ? `${n.estimated_duration_seconds}s` : "—"}
                  </div>
                </Card>

                <Card className="p-4">
                  <div className="text-xs text-muted-foreground flex items-center gap-1"><Calendar className="h-3 w-3" /> Expires</div>
                  <div className="mt-1 font-semibold">
                    {n.expires_at ? new Date(n.expires_at).toLocaleString() : "No expiry"}
                  </div>
                </Card>
              </div>

              <div>
                <h3 className="text-sm font-semibold flex items-center gap-1 mb-2"><History className="h-4 w-4" /> Broadcast history</h3>
                {history.data?.length ? (
                  <Table>
                    <TableHeader><TableRow><TableHead>Station</TableHead><TableHead>Time</TableHead><TableHead>Program</TableHead></TableRow></TableHeader>
                    <TableBody>
                      {history.data.map((h) => {
                        // eslint-disable-next-line @typescript-eslint/no-explicit-any
                        const station = (h as any).stations;
                        return (
                          <TableRow key={h.id}>
                            <TableCell>{station?.name ?? h.station_id}</TableCell>
                            <TableCell className="text-xs">{new Date(h.broadcast_time).toLocaleString()}</TableCell>
                            <TableCell>{h.program_name ?? "—"}</TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                ) : (
                  <p className="text-sm text-muted-foreground">Not yet broadcast.</p>
                )}
              </div>
            </TabsContent>

            <TabsContent value="script" className="space-y-3">
              <div>
                <h3 className="text-sm font-semibold flex items-center gap-1 mb-1"><Tag className="h-4 w-4" /> Radio script</h3>
                <pre className="whitespace-pre-wrap text-sm bg-muted/40 p-3 rounded">{n.radio_script || "—"}</pre>
              </div>
              <div>
                <h3 className="text-sm font-semibold mb-1">Full article</h3>
                <pre className="whitespace-pre-wrap text-sm bg-muted/40 p-3 rounded">{n.full_article || "—"}</pre>
              </div>
            </TabsContent>
          </Tabs>
        )}
      </DialogContent>
    </Dialog>
  );
}
