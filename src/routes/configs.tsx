import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { database } from "@/services/database";
import { generateStationConfig } from "@/lib/streaming.functions";
import { ResourcePageShell } from "@/components/resource-page-shell";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { PlaceholderNotice } from "@/components/placeholder-notice";
import { useAuth } from "@/lib/auth";
import { useStationScope, useActiveStation } from "@/lib/station-context";
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
  const { scope } = useStationScope();
  const station = useActiveStation();
  const [output, setOutput] = useState<GenResult | null>(null);

  // Reset output when station changes.
  useEffect(() => { setOutput(null); }, [station?.id]);

  const liq = useQuery({
    queryKey: ["configs-liq", station?.id],
    enabled: !!station,
    queryFn: async () =>
      (await database.from("liquidsoap_configs").select("generated_at").eq("station_id", station!.id).maybeSingle()).data,
  });

  const generate = useServerFn(generateStationConfig);
  const regen = useMutation({
    mutationFn: async (persist: boolean) => (await generate({ data: { stationId: station!.id, persist } })) as GenResult,
    onSuccess: (r, persist) => {
      setOutput(r);
      toast.success(persist ? "Configs regenerated and saved" : "Preview generated");
      liq.refetch();
    },
    onError: (e: any) => toast.error(e.message ?? "Generation failed"),
  });

  const noStation = scope.kind !== "station";

  const state =
    noStation
      ? { kind: "empty" as const, title: "Pick a station", hint: "Configs are generated per station — choose one in the switcher." }
      : { kind: "ready" as const };

  const primaryAction = station && (
    <div className="flex items-center gap-2">
      <Button variant="outline" size="sm" onClick={() => regen.mutate(false)} disabled={regen.isPending}>
        <FileCode2 className="w-4 h-4 mr-1.5" /> Preview
      </Button>
      <Button size="sm" onClick={() => regen.mutate(true)} disabled={!isAdmin || regen.isPending}>
        <RefreshCw className={`w-4 h-4 mr-1.5 ${regen.isPending ? "animate-spin" : ""}`} /> Regenerate
      </Button>
    </div>
  );

  return (
    <ResourcePageShell
      title="Config Generator"
      description="Generate icecast.xml, radio.liq and playlist .m3u from database settings."
      primaryAction={primaryAction}
      state={state}
      wrapContent={false}
    >
      <PlaceholderNotice title="Database is the source of truth">
        All streaming configuration is generated from this app. Never hand-edit <code>icecast.xml</code> or
        <code> .liq</code> files on the runtime — change settings here, regenerate, and deploy.
      </PlaceholderNotice>

      {station && (
        <Card className="p-4 mt-4">
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <div className="text-xs text-muted-foreground">
              Station <code className="font-mono">{station.slug}</code> — emits <code>icecast.xml</code>, <code>radio.liq</code> and any playlist <code>.m3u</code> files.
            </div>
            {liq.data?.generated_at && (
              <Badge variant="outline" className="text-[10px]">
                Last saved: {new Date(liq.data.generated_at).toLocaleString()}
              </Badge>
            )}
          </div>
        </Card>
      )}

      {output && (
        <Card className="p-0 overflow-hidden mt-4">
          <Tabs defaultValue="liq">
            <TabsList className="rounded-none border-b border-border w-full justify-start">
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
                    <code className="text-xs font-mono">{f.name}</code>
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
    </ResourcePageShell>
  );
}
