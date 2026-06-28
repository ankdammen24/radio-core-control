import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Card } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { AppLayout } from "@/components/app-layout";
import { useAuth } from "@/lib/auth";
import { toast } from "sonner";
import { Plus, RefreshCw, Podcast as PodcastIcon, Activity, Trash2 } from "lucide-react";
import {
  listPodcastSources,
  upsertPodcastSource,
  deletePodcastSource,
  triggerPodcastSync,
  listPodcasts,
  listEpisodes,
  listSyncRuns,
  podcastStats,
} from "@/lib/podcasts.functions";

export const Route = createFileRoute("/podcast-hub")({ component: PodcastHubPage });

type SourceForm = {
  id?: string;
  name: string;
  kind: "fablesh" | "rss";
  base_url: string;
  auth_secret_name: string;
  sync_interval_minutes: number;
  is_active: boolean;
};

const EMPTY_SOURCE: SourceForm = {
  name: "",
  kind: "fablesh",
  base_url: "",
  auth_secret_name: "",
  sync_interval_minutes: 15,
  is_active: true,
};

function PodcastHubPage() {
  const qc = useQueryClient();
  const { isAdmin, isEditor } = useAuth();
  const [tab, setTab] = useState("podcasts");

  const sources = useQuery({
    queryKey: ["podcast-sources"],
    queryFn: () => listPodcastSources(),
  });
  const podcasts = useQuery({
    queryKey: ["podcasts"],
    queryFn: () => listPodcasts({ data: {} }),
  });
  const stats = useQuery({
    queryKey: ["podcast-stats"],
    queryFn: () => podcastStats({ data: {} }),
  });
  const runs = useQuery({
    queryKey: ["podcast-runs"],
    queryFn: () => listSyncRuns({ data: { limit: 25 } }),
  });

  const upsertFn = useServerFn(upsertPodcastSource);
  const deleteFn = useServerFn(deletePodcastSource);
  const syncFn = useServerFn(triggerPodcastSync);

  const [sourceOpen, setSourceOpen] = useState(false);
  const [sourceForm, setSourceForm] = useState<SourceForm>(EMPTY_SOURCE);
  const [sourceTouched, setSourceTouched] = useState(false);

  const sourceErrors = (() => {
    const errs: { name?: string; base_url?: string; auth_secret_name?: string } = {};
    if (!sourceForm.name.trim()) errs.name = "Name is required.";
    const url = sourceForm.base_url.trim();
    if (!url) {
      errs.base_url = "Base URL is required.";
    } else {
      try {
        const u = new URL(url);
        if (u.protocol !== "https:" && u.protocol !== "http:") {
          errs.base_url = "Base URL must start with http:// or https://";
        }
      } catch {
        errs.base_url = "Not a valid URL (e.g. https://api.fablesh.com).";
      }
    }
    if (sourceForm.kind === "fablesh") {
      const secret = sourceForm.auth_secret_name.trim();
      if (!secret) {
        errs.auth_secret_name = "Fablesh requires an auth secret name (e.g. FABLESH_API_TOKEN).";
      } else if (!/^[A-Z_][A-Z0-9_]*$/.test(secret)) {
        errs.auth_secret_name = "Use uppercase letters, digits and underscores only (env-var convention).";
      }
    }
    return errs;
  })();
  const hasSourceErrors = Object.keys(sourceErrors).length > 0;

  const saveSource = useMutation({
    mutationFn: async () => {
      setSourceTouched(true);
      if (hasSourceErrors) {
        throw new Error(Object.values(sourceErrors)[0] ?? "Invalid form");
      }
      return upsertFn({
        data: {
          id: sourceForm.id,
          name: sourceForm.name.trim(),
          kind: sourceForm.kind,
          base_url: sourceForm.base_url.trim(),
          auth_secret_name: sourceForm.auth_secret_name.trim() || null,
          sync_interval_minutes: sourceForm.sync_interval_minutes,
          is_active: sourceForm.is_active,
        },
      });
    },
    onSuccess: () => {
      toast.success(sourceForm.id ? "Source updated" : "Source created");
      setSourceOpen(false);
      setSourceForm(EMPTY_SOURCE);
      setSourceTouched(false);
      qc.invalidateQueries({ queryKey: ["podcast-sources"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const syncSource = useMutation({
    mutationFn: (id: string) => syncFn({ data: { source_id: id } }),
    onSuccess: (r) => {
      const s = r.result;
      toast.success(
        `Sync ${s.status}: ${s.podcasts_seen} podcasts • ${s.episodes_new} new • ${s.episodes_updated} updated • ${s.episodes_deleted} removed`,
      );
      qc.invalidateQueries({ queryKey: ["podcasts"] });
      qc.invalidateQueries({ queryKey: ["podcast-runs"] });
      qc.invalidateQueries({ queryKey: ["podcast-sources"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const deleteSource = useMutation({
    mutationFn: (id: string) => deleteFn({ data: { id } }),
    onSuccess: () => {
      toast.success("Source removed");
      qc.invalidateQueries({ queryKey: ["podcast-sources"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <AppLayout title="Podcast Hub" description="Central distribution between podcast sources (Fablesh) and broadcast stations.">
      <div className="p-6 space-y-6">
        <header className="flex items-start justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 text-[10px] uppercase tracking-[0.25em] text-muted-foreground mb-1">
              <PodcastIcon className="w-3 h-3" /> Podcast Hub
            </div>
            <h1 className="text-2xl font-semibold tracking-tight">Podcast Hub</h1>
            <p className="text-sm text-muted-foreground mt-1 max-w-2xl">
              Central distribution between podcast sources (Fablesh) and broadcast stations.
              Audio streamas direkt från Fablesh via dess API — Radio Core cachar enbart metadata.
            </p>
          </div>
          <div className="flex gap-2">
            {isAdmin && (
              <Button size="sm" onClick={() => { setSourceForm(EMPTY_SOURCE); setSourceOpen(true); }}>
                <Plus className="w-4 h-4 mr-1" /> New source
              </Button>
            )}
          </div>
        </header>

        {/* KPIs */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <Card className="p-4">
            <div className="text-[10px] uppercase tracking-wider text-muted-foreground">Podcasts</div>
            <div className="text-2xl font-semibold mt-1">{stats.data?.podcasts ?? "—"}</div>
          </Card>
          <Card className="p-4">
            <div className="text-[10px] uppercase tracking-wider text-muted-foreground">Episodes</div>
            <div className="text-2xl font-semibold mt-1">{stats.data?.episodes ?? "—"}</div>
          </Card>
          <Card className="p-4">
            <div className="text-[10px] uppercase tracking-wider text-muted-foreground">Sources</div>
            <div className="text-2xl font-semibold mt-1">{sources.data?.sources.length ?? "—"}</div>
          </Card>
          <Card className="p-4">
            <div className="text-[10px] uppercase tracking-wider text-muted-foreground">Last sync</div>
            <div className="text-sm font-mono mt-2">
              {stats.data?.recent_runs?.[0]?.started_at
                ? new Date(stats.data.recent_runs[0].started_at).toLocaleString()
                : "—"}
            </div>
          </Card>
        </div>

        <Tabs value={tab} onValueChange={setTab}>
          <TabsList>
            <TabsTrigger value="podcasts">Podcasts</TabsTrigger>
            <TabsTrigger value="sources">Sources</TabsTrigger>
            <TabsTrigger value="runs">Sync log</TabsTrigger>
          </TabsList>

          {/* Podcasts tab */}
          <TabsContent value="podcasts" className="mt-4">
            <Card className="overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Title</TableHead>
                    <TableHead>Source</TableHead>
                    <TableHead>Language</TableHead>
                    <TableHead>Categories</TableHead>
                    <TableHead>Last updated</TableHead>
                    <TableHead className="text-right">Episodes</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {(podcasts.data?.podcasts ?? []).length === 0 && (
                    <TableRow>
                      <TableCell colSpan={6} className="text-center py-10 text-sm text-muted-foreground">
                        No podcasts yet. Add a source and run a sync.
                      </TableCell>
                    </TableRow>
                  )}
                  {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
                  {(podcasts.data?.podcasts ?? []).map((p: any) => (
                    <PodcastRow key={p.id} podcast={p} />
                  ))}
                </TableBody>
              </Table>
            </Card>
          </TabsContent>

          {/* Sources tab */}
          <TabsContent value="sources" className="mt-4">
            <Card className="overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Name</TableHead>
                    <TableHead>Kind</TableHead>
                    <TableHead>Base URL</TableHead>
                    <TableHead>Secret</TableHead>
                    <TableHead>Interval</TableHead>
                    <TableHead>Last synced</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {(sources.data?.sources ?? []).length === 0 && (
                    <TableRow>
                      <TableCell colSpan={7} className="text-center py-10 text-sm text-muted-foreground">
                        No podcast sources configured yet.
                      </TableCell>
                    </TableRow>
                  )}
                  {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
                  {(sources.data?.sources ?? []).map((s: any) => (
                    <TableRow key={s.id}>
                      <TableCell className="font-medium">{s.name}</TableCell>
                      <TableCell>
                        <Badge variant="outline" className="text-[10px] uppercase">{s.kind}</Badge>
                      </TableCell>
                      <TableCell className="font-mono text-xs truncate max-w-[260px]" title={s.base_url}>
                        {s.base_url}
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground">
                        {s.auth_secret_name ?? "—"}
                      </TableCell>
                      <TableCell className="text-xs">{s.sync_interval_minutes}m</TableCell>
                      <TableCell className="text-xs text-muted-foreground">
                        {s.last_synced_at ? new Date(s.last_synced_at).toLocaleString() : "—"}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-1">
                          {isEditor && (
                            <Button size="sm" variant="outline" disabled={syncSource.isPending}
                              onClick={() => syncSource.mutate(s.id)}>
                              <RefreshCw className="w-3.5 h-3.5 mr-1" /> Sync
                            </Button>
                          )}
                          {isAdmin && (
                            <>
                              <Button size="sm" variant="ghost" onClick={() => {
                                setSourceForm({
                                  id: s.id, name: s.name, kind: s.kind, base_url: s.base_url,
                                  auth_secret_name: s.auth_secret_name ?? "",
                                  sync_interval_minutes: s.sync_interval_minutes,
                                  is_active: s.is_active,
                                });
                                setSourceOpen(true);
                              }}>Edit</Button>
                              <Button size="sm" variant="ghost" className="text-destructive"
                                onClick={() => { if (confirm("Delete source and all its podcasts?")) deleteSource.mutate(s.id); }}>
                                <Trash2 className="w-3.5 h-3.5" />
                              </Button>
                            </>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </Card>
          </TabsContent>

          {/* Sync log */}
          <TabsContent value="runs" className="mt-4">
            <Card className="overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Started</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Podcasts</TableHead>
                    <TableHead className="text-right">New</TableHead>
                    <TableHead className="text-right">Updated</TableHead>
                    <TableHead className="text-right">Removed</TableHead>
                    <TableHead>Error</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
                  {(runs.data?.runs ?? []).map((r: any) => (
                    <TableRow key={r.id}>
                      <TableCell className="text-xs">{new Date(r.started_at).toLocaleString()}</TableCell>
                      <TableCell>
                        <Badge variant="outline" className="text-[10px] uppercase">{r.status}</Badge>
                      </TableCell>
                      <TableCell className="text-right text-xs">{r.podcasts_seen}</TableCell>
                      <TableCell className="text-right text-xs">{r.episodes_new}</TableCell>
                      <TableCell className="text-right text-xs">{r.episodes_updated}</TableCell>
                      <TableCell className="text-right text-xs">{r.episodes_deleted}</TableCell>
                      <TableCell className="text-xs text-destructive truncate max-w-[260px]" title={r.error ?? ""}>
                        {r.error ?? "—"}
                      </TableCell>
                    </TableRow>
                  ))}
                  {(runs.data?.runs ?? []).length === 0 && (
                    <TableRow>
                      <TableCell colSpan={7} className="text-center py-10 text-sm text-muted-foreground">
                        No sync runs yet.
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </Card>
          </TabsContent>
        </Tabs>
      </div>

      {/* Source editor */}
      <Dialog
        open={sourceOpen}
        onOpenChange={(open) => {
          setSourceOpen(open);
          if (!open) setSourceTouched(false);
        }}
      >
        <DialogContent className="max-w-xl">
          <DialogHeader>
            <DialogTitle>{sourceForm.id ? "Edit source" : "New podcast source"}</DialogTitle>
          </DialogHeader>
          <div className="grid grid-cols-2 gap-3">
            <div className="col-span-2">
              <Label>Name *</Label>
              <Input
                value={sourceForm.name}
                onChange={(e) => setSourceForm({ ...sourceForm, name: e.target.value })}
                placeholder="Fablesh Production"
                aria-invalid={sourceTouched && !!sourceErrors.name}
                className={sourceTouched && sourceErrors.name ? "border-destructive" : undefined}
              />
              {sourceTouched && sourceErrors.name && (
                <p className="text-[11px] text-destructive mt-1">{sourceErrors.name}</p>
              )}
            </div>
            <div>
              <Label>Kind *</Label>
              <Select value={sourceForm.kind} onValueChange={(v) => setSourceForm({ ...sourceForm, kind: v as "fablesh" | "rss" })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="fablesh">Fablesh REST</SelectItem>
                  <SelectItem value="rss" disabled>RSS (coming soon)</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Sync interval (min)</Label>
              <Input type="number" min={1} max={1440} value={sourceForm.sync_interval_minutes}
                onChange={(e) => setSourceForm({ ...sourceForm, sync_interval_minutes: Number(e.target.value) || 15 })} />
            </div>
            <div className="col-span-2">
              <Label>Base URL *</Label>
              <Input
                value={sourceForm.base_url}
                onChange={(e) => setSourceForm({ ...sourceForm, base_url: e.target.value })}
                placeholder="https://api.fablesh.example"
                aria-invalid={sourceTouched && !!sourceErrors.base_url}
                className={sourceTouched && sourceErrors.base_url ? "border-destructive" : undefined}
              />
              {sourceTouched && sourceErrors.base_url && (
                <p className="text-[11px] text-destructive mt-1">{sourceErrors.base_url}</p>
              )}
            </div>
            <div className="col-span-2">
              <Label>
                Auth secret name {sourceForm.kind === "fablesh" && <span className="text-destructive">*</span>}
              </Label>
              <Input
                value={sourceForm.auth_secret_name}
                onChange={(e) => setSourceForm({ ...sourceForm, auth_secret_name: e.target.value })}
                placeholder="FABLESH_API_TOKEN"
                aria-invalid={sourceTouched && !!sourceErrors.auth_secret_name}
                className={sourceTouched && sourceErrors.auth_secret_name ? "border-destructive" : undefined}
              />
              {sourceTouched && sourceErrors.auth_secret_name ? (
                <p className="text-[11px] text-destructive mt-1">{sourceErrors.auth_secret_name}</p>
              ) : (
                <p className="text-[10px] text-muted-foreground mt-1">
                  Name of an environment variable holding the Bearer token. Configure the value via the secrets panel — never paste raw tokens here.
                </p>
              )}
            </div>
            <div className="col-span-2 flex items-center gap-2">
              <Switch id="active" checked={sourceForm.is_active} onCheckedChange={(v) => setSourceForm({ ...sourceForm, is_active: v })} />
              <Label htmlFor="active">Active</Label>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setSourceOpen(false)}>Cancel</Button>
            <Button
              onClick={() => {
                setSourceTouched(true);
                if (!hasSourceErrors) saveSource.mutate();
              }}
              disabled={saveSource.isPending || (sourceTouched && hasSourceErrors)}
            >
              {saveSource.isPending ? "Saving…" : sourceForm.id ? "Save" : "Create"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AppLayout>
  );
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function PodcastRow({ podcast }: { podcast: any }) {
  const [open, setOpen] = useState(false);
  const eps = useQuery({
    queryKey: ["podcast-episodes", podcast.id],
    queryFn: () => listEpisodes({ data: { podcast_id: podcast.id } }),
    enabled: open,
  });
  return (
    <>
      <TableRow className="cursor-pointer hover:bg-muted/40" onClick={() => setOpen((v) => !v)}>
        <TableCell className="font-medium">
          <div className="flex items-center gap-2">
            {podcast.artwork_url
              ? <img src={podcast.artwork_url} alt="" className="w-7 h-7 rounded object-cover" />
              : <PodcastIcon className="w-4 h-4 text-muted-foreground" />}
            {podcast.title}
          </div>
        </TableCell>
        <TableCell className="text-xs text-muted-foreground">
          {podcast.podcast_sources?.name ?? "—"}
        </TableCell>
        <TableCell><Badge variant="outline" className="text-[10px] uppercase">{podcast.language ?? "—"}</Badge></TableCell>
        <TableCell className="text-xs text-muted-foreground">
          {(podcast.categories ?? []).slice(0, 3).join(", ") || "—"}
        </TableCell>
        <TableCell className="text-xs text-muted-foreground">
          {podcast.last_updated_at ? new Date(podcast.last_updated_at).toLocaleDateString() : "—"}
        </TableCell>
        <TableCell className="text-right text-xs">
          <Activity className="w-3 h-3 inline mr-1 text-muted-foreground" />
          {open ? (eps.data?.episodes.length ?? "…") : "view"}
        </TableCell>
      </TableRow>
      {open && (
        <TableRow>
          <TableCell colSpan={6} className="bg-muted/20 p-3">
            <div className="text-[11px] uppercase tracking-wider text-muted-foreground mb-2">Episodes</div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-1 max-h-72 overflow-y-auto">
              {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
              {(eps.data?.episodes ?? []).map((e: any) => (
                <div key={e.id} className="text-xs px-2 py-1 rounded bg-background border border-border flex items-center justify-between gap-2">
                  <div className="truncate">
                    <span className="font-medium">{e.title}</span>
                    {e.episode_number != null && <span className="text-muted-foreground"> · #{e.episode_number}</span>}
                  </div>
                  <span className="text-muted-foreground tabular-nums">
                    {e.duration_seconds ? `${Math.round(e.duration_seconds / 60)}m` : ""}
                  </span>
                </div>
              ))}
              {eps.isLoading && <div className="text-xs text-muted-foreground">Loading…</div>}
              {(eps.data?.episodes ?? []).length === 0 && !eps.isLoading && (
                <div className="text-xs text-muted-foreground">No episodes.</div>
              )}
            </div>
          </TableCell>
        </TableRow>
      )}
    </>
  );
}
