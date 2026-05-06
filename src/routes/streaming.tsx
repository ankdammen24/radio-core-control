import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { AppLayout } from "@/components/app-layout";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { PlaceholderNotice } from "@/components/placeholder-notice";
import { useState } from "react";
import { toast } from "sonner";
import { useServerFn } from "@tanstack/react-start";
import { generateStationConfig } from "@/server/streaming.functions";
import { FileCode2, Download, Wand2 } from "lucide-react";
import { useAuth } from "@/lib/auth";

export const Route = createFileRoute("/streaming")({ component: StreamingPage });

function download(name: string, content: string) {
  const blob = new Blob([content], { type: "text/plain" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob); a.download = name; a.click(); URL.revokeObjectURL(a.href);
}

function StreamingPage() {
  const qc = useQueryClient();
  const { isAdmin } = useAuth();
  const [stationId, setStationId] = useState<string>("");
  const [output, setOutput] = useState<{ icecastXml: string; liquidsoapLiq: string; m3uFiles: { name: string; content: string }[] } | null>(null);

  const { data: stations } = useQuery({
    queryKey: ["stations-streaming"],
    queryFn: async () => (await supabase.from("stations").select("id,name,slug").order("name")).data ?? [],
  });

  const ic = useQuery({
    queryKey: ["ic", stationId], enabled: !!stationId,
    queryFn: async () => (await supabase.from("icecast_configs").select("*").eq("station_id", stationId).maybeSingle()).data,
  });
  const liq = useQuery({
    queryKey: ["liq", stationId], enabled: !!stationId,
    queryFn: async () => (await supabase.from("liquidsoap_configs").select("*").eq("station_id", stationId).maybeSingle()).data,
  });
  const mounts = useQuery({
    queryKey: ["mounts", stationId], enabled: !!stationId,
    queryFn: async () => (await supabase.from("stream_mounts").select("*").eq("station_id", stationId)).data ?? [],
  });

  const ensureDefaults = useMutation({
    mutationFn: async () => {
      if (!stationId) throw new Error("Pick a station");
      if (!ic.data) await supabase.from("icecast_configs").insert({ station_id: stationId });
      if (!liq.data) await supabase.from("liquidsoap_configs").insert({ station_id: stationId });
      if (!mounts.data || mounts.data.length === 0) {
        const slug = (stations ?? []).find((s) => s.id === stationId)?.slug ?? "live";
        await supabase.from("stream_mounts").insert({ station_id: stationId, mount_path: `/${slug}.mp3`, format: "mp3", bitrate: 128, is_default: true });
      }
    },
    onSuccess: () => { toast.success("Streaming defaults created"); qc.invalidateQueries(); },
    onError: (e: any) => toast.error(e.message),
  });

  const generate = useServerFn(generateStationConfig);
  const gen = useMutation({
    mutationFn: async (persist: boolean) => generate({ data: { stationId, persist } }),
    onSuccess: (r) => { setOutput(r); toast.success(`Generated config (${r.playlistsCount} playlists)`); },
    onError: (e: any) => toast.error(e.message ?? "Generation failed"),
  });

  return (
    <AppLayout title="Streaming Config" subtitle="Generate Icecast & Liquidsoap configuration from the database">
      <PlaceholderNotice title="Lovable runs the control plane only">
        Liquidsoap & Icecast-KH must run on a separate Docker host. Use the generated files (or the public <code>/api/public/station-config</code> endpoint) to feed your stack.
      </PlaceholderNotice>

      <Card className="p-4 mb-4">
        <div className="flex items-end gap-3 flex-wrap">
          <div className="min-w-64">
            <label className="text-xs uppercase text-muted-foreground">Station</label>
            <Select value={stationId} onValueChange={setStationId}>
              <SelectTrigger><SelectValue placeholder="Select a station" /></SelectTrigger>
              <SelectContent>
                {(stations ?? []).map((s) => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <Button variant="outline" disabled={!stationId || !isAdmin} onClick={() => ensureDefaults.mutate()}>
            Create defaults
          </Button>
          <Button disabled={!stationId} onClick={() => gen.mutate(false)}>
            <Wand2 className="w-4 h-4 mr-2" /> Preview
          </Button>
          <Button disabled={!stationId || !isAdmin} variant="secondary" onClick={() => gen.mutate(true)}>
            <FileCode2 className="w-4 h-4 mr-2" /> Generate & save
          </Button>
        </div>
        <div className="mt-3 text-xs text-muted-foreground">
          Status — icecast: {ic.data ? "✓" : "missing"} · liquidsoap: {liq.data ? "✓" : "missing"} · mounts: {mounts.data?.length ?? 0}
        </div>
      </Card>

      {output && (
        <Card className="p-0 overflow-hidden">
          <Tabs defaultValue="liq" className="w-full">
            <TabsList className="rounded-none border-b w-full justify-start">
              <TabsTrigger value="liq">liquidsoap.liq</TabsTrigger>
              <TabsTrigger value="xml">icecast.xml</TabsTrigger>
              <TabsTrigger value="pls">playlists ({output.m3uFiles.length})</TabsTrigger>
            </TabsList>
            <TabsContent value="liq" className="p-4">
              <div className="flex justify-end mb-2">
                <Button size="sm" variant="outline" onClick={() => download("liquidsoap.liq", output.liquidsoapLiq)}>
                  <Download className="w-4 h-4 mr-2" /> Download
                </Button>
              </div>
              <Textarea readOnly value={output.liquidsoapLiq} className="font-mono text-xs min-h-[400px]" />
            </TabsContent>
            <TabsContent value="xml" className="p-4">
              <div className="flex justify-end mb-2">
                <Button size="sm" variant="outline" onClick={() => download("icecast.xml", output.icecastXml)}>
                  <Download className="w-4 h-4 mr-2" /> Download
                </Button>
              </div>
              <Textarea readOnly value={output.icecastXml} className="font-mono text-xs min-h-[400px]" />
            </TabsContent>
            <TabsContent value="pls" className="p-4 space-y-3">
              {output.m3uFiles.length === 0 && <div className="text-sm text-muted-foreground">No active playlists.</div>}
              {output.m3uFiles.map((f) => (
                <div key={f.name}>
                  <div className="flex items-center justify-between mb-1">
                    <code className="text-xs">{f.name}</code>
                    <Button size="sm" variant="outline" onClick={() => download(f.name, f.content)}>
                      <Download className="w-4 h-4 mr-2" /> Download
                    </Button>
                  </div>
                  <Textarea readOnly value={f.content} className="font-mono text-xs min-h-[120px]" />
                </div>
              ))}
            </TabsContent>
          </Tabs>
        </Card>
      )}
    </AppLayout>
  );
}
