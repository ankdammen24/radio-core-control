import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { generateStationConfig } from "@/server/streaming.functions";
import { AppLayout } from "@/components/app-layout";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { PlaceholderNotice } from "@/components/placeholder-notice";
import { useAuth } from "@/lib/auth";
import { RefreshCw, Download, FileCode2 } from "lucide-react";

export const Route = createFileRoute("/configs")({ component: ConfigsPage });

function download(name: string, content: string) {
  const blob = new Blob([content], { type: "text/plain" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = name;
  a.click();
  URL.revokeObjectURL(a.href);
}

type GenResult = {
  icecastXml: string;
  liquidsoapLiq: string;
  m3uFiles: { name: string; content: string }[];
  playlistsCount: number;
};

function ConfigsPage() {
  const { isAdmin } = useAuth();
  const [stationId, setStationId] = useState<string>("");
  const [output, setOutput] = useState<GenResult | null>(null);

  const { data: stations } = useQuery({
    queryKey: ["stations-configs"],
    queryFn: async () =>
      (await supabase.from("stations").select("id,name,slug").eq("is_active", true).order("name")).data ?? [],
  });

  const liq = useQuery({
    queryKey: ["configs-liq", stationId],
    enabled: !!stationId,
    queryFn: async () =>
      (await supabase.from("liquidsoap_configs").select("generated_at").eq("station_id", stationId).maybeSingle()).data,
  });

  const generate = useServerFn(generateStationConfig);

  const regen = useMutation({
    mutationFn: async (persist: boolean) => (await generate({ data: { stationId, persist } })) as GenResult,
    onSuccess: (r, persist) => {
      setOutput(r);
      toast.success(persist ? "Configs regenerated and saved" : "Preview generated");
      liq.refetch();
    },
    onError: (e: any) => toast.error(e.message ?? "Generation failed"),
  });

  const station = stations?.find((s) => s.id === stationId);

  return (
    <AppLayout title="Config Generator" description="Generate icecast.xml and radio.liq from database settings">
      <PlaceholderNotice title="Database is the source of truth">
        All streaming configuration is generated from this app. Never hand-edit <code>icecast.xml</code> or
        <code> .liq</code> files on the server — change settings here, regenerate, and deploy.
      </PlaceholderNotice>

      <Card className="p-4 mb-4">
        <div className="flex items-end gap-3 flex-wrap">
          <div className="min-w-72">
            <label className="text-xs uppercase text-muted-foreground">Station</label>
            <Select value={stationId} onValueChange={(v) => { setStationId(v); setOutput(null); }}>
              <SelectTrigger><SelectValue placeholder="Select a station" /></SelectTrigger>
              <SelectContent>
                {(stations ?? []).map((s) => (
                  <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <Button disabled={!stationId} variant="outline" onClick={() => regen.mutate(false)}>
            <FileCode2 className="w-4 h-4 mr-2" /> Preview
          </Button>
          <Button disabled={!stationId || !isAdmin} onClick={() => regen.mutate(true)}>
            <RefreshCw className={`w-4 h-4 mr-2 ${regen.isPending ? "animate-spin" : ""}`} />
            Regenerate
          </Button>

          {liq.data?.generated_at && (
            <Badge variant="outline" className="ml-auto">
              Last saved: {new Date(liq.data.generated_at).toLocaleString()}
            </Badge>
          )}
        </div>
        {station && (
          <div className="mt-3 text-xs text-muted-foreground">
            Station <code>{station.slug}</code> — generates <code>icecast.xml</code>, <code>radio.liq</code> and any
            playlist <code>.m3u</code> files from current DB state.
          </div>
        )}
      </Card>

      {output && (
        <Card className="p-0 overflow-hidden">
          <Tabs defaultValue="liq">
            <TabsList className="rounded-none border-b w-full justify-start">
              <TabsTrigger value="liq">radio.liq</TabsTrigger>
              <TabsTrigger value="xml">icecast.xml</TabsTrigger>
              <TabsTrigger value="pls">playlists ({output.m3uFiles.length})</TabsTrigger>
            </TabsList>

            <TabsContent value="liq" className="p-4">
              <div className="flex justify-end mb-2">
                <Button size="sm" variant="outline" onClick={() => download("radio.liq", output.liquidsoapLiq)}>
                  <Download className="w-4 h-4 mr-2" /> Download
                </Button>
              </div>
              <Textarea readOnly value={output.liquidsoapLiq} className="font-mono text-xs min-h-[420px]" />
            </TabsContent>

            <TabsContent value="xml" className="p-4">
              <div className="flex justify-end mb-2">
                <Button size="sm" variant="outline" onClick={() => download("icecast.xml", output.icecastXml)}>
                  <Download className="w-4 h-4 mr-2" /> Download
                </Button>
              </div>
              <Textarea readOnly value={output.icecastXml} className="font-mono text-xs min-h-[420px]" />
            </TabsContent>

            <TabsContent value="pls" className="p-4 space-y-3">
              {output.m3uFiles.length === 0 && (
                <div className="text-sm text-muted-foreground">No active playlists.</div>
              )}
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
