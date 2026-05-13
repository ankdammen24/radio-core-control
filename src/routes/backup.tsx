import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState, useRef } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { exportStationSnapshot, importStationSnapshot } from "@/lib/backup.functions";
import { AppLayout } from "@/components/app-layout";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { PlaceholderNotice } from "@/components/placeholder-notice";
import { useAuth } from "@/lib/auth";
import { Download, Upload, Archive } from "lucide-react";

export const Route = createFileRoute("/backup")({ component: BackupPage });

function BackupPage() {
  const { isAdmin } = useAuth();
  const [exportStation, setExportStation] = useState("");
  const [importStation, setImportStation] = useState("");
  const [replace, setReplace] = useState(true);
  const [snapshot, setSnapshot] = useState<any>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const { data: stations } = useQuery({
    queryKey: ["stations-backup"],
    queryFn: async () =>
      (await supabase.from("stations").select("id,name,slug").order("name")).data ?? [],
  });

  const exportFn = useServerFn(exportStationSnapshot);
  const importFn = useServerFn(importStationSnapshot);

  const exportMut = useMutation({
    mutationFn: async () => (await exportFn({ data: { stationId: exportStation } })) as any,
    onSuccess: (snap: any) => {
      const blob = new Blob([JSON.stringify(snap, null, 2)], { type: "application/json" });
      const a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      a.download = `radio-core-snapshot-${snap.station.slug}-${snap.exported_at.replace(/[:.]/g, "-")}.json`;
      a.click();
      URL.revokeObjectURL(a.href);
      toast.success("Snapshot exported");
    },
    onError: (e: any) => toast.error(e.message ?? "Export failed"),
  });

  const importMut = useMutation({
    mutationFn: async () =>
      (await importFn({ data: { targetStationId: importStation, snapshot, replace } })) as any,
    onSuccess: (r: any) => {
      const lines = Object.entries(r.summary).map(([k, v]) => `${k}: ${v}`).join("\n");
      toast.success(`Snapshot imported\n${lines}`);
    },
    onError: (e: any) => toast.error(e.message ?? "Import failed"),
  });

  const handleFile = (f: File) => {
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const json = JSON.parse(String(reader.result));
        setSnapshot(json);
        toast.success(`Loaded snapshot for "${json.station?.name}"`);
      } catch {
        toast.error("Invalid JSON file");
      }
    };
    reader.readAsText(f);
  };

  return (
    <AppLayout title="Backup & Restore" description="Export and import a full station snapshot">
      <PlaceholderNotice title="What's included">
        Snapshots contain station metadata, streaming configs (Icecast, Liquidsoap, mounts, live input,
        Stereo Tool), playlists with assignments, rotation rules, schedule blocks and fallback tracks.
        Media files are referenced by ID — they are not copied. Audit logs, play history and listener
        stats are excluded.
      </PlaceholderNotice>

      <div className="grid md:grid-cols-2 gap-4 mt-4">
        <Card className="p-5">
          <div className="flex items-center gap-2 mb-3">
            <Archive className="w-4 h-4" />
            <h2 className="font-semibold">Export</h2>
          </div>
          <label className="text-xs uppercase text-muted-foreground">Station</label>
          <Select value={exportStation} onValueChange={setExportStation}>
            <SelectTrigger><SelectValue placeholder="Select a station" /></SelectTrigger>
            <SelectContent>
              {(stations ?? []).map((s) => (
                <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button
            className="mt-4 w-full"
            disabled={!exportStation || exportMut.isPending}
            onClick={() => exportMut.mutate()}
          >
            <Download className="w-4 h-4 mr-2" />
            {exportMut.isPending ? "Exporting…" : "Download Snapshot (.json)"}
          </Button>
        </Card>

        <Card className="p-5">
          <div className="flex items-center gap-2 mb-3">
            <Upload className="w-4 h-4" />
            <h2 className="font-semibold">Import</h2>
          </div>

          <input
            ref={fileRef}
            type="file"
            accept="application/json,.json"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) handleFile(f);
            }}
          />
          <Button variant="outline" className="w-full" onClick={() => fileRef.current?.click()}>
            <Upload className="w-4 h-4 mr-2" /> Choose snapshot file
          </Button>

          {snapshot && (
            <div className="mt-3 text-xs text-muted-foreground space-y-1">
              <div>
                Source station: <Badge variant="outline">{snapshot.station?.name} ({snapshot.station?.slug})</Badge>
              </div>
              <div>Exported: {new Date(snapshot.exported_at).toLocaleString()}</div>
              <div>Version: {snapshot.version}</div>
            </div>
          )}

          <div className="mt-4">
            <label className="text-xs uppercase text-muted-foreground">Target station</label>
            <Select value={importStation} onValueChange={setImportStation}>
              <SelectTrigger><SelectValue placeholder="Select target station" /></SelectTrigger>
              <SelectContent>
                {(stations ?? []).map((s) => (
                  <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <label className="flex items-center gap-2 mt-3 text-sm">
            <Checkbox checked={replace} onCheckedChange={(v) => setReplace(!!v)} />
            <span>Replace existing data on target station (recommended)</span>
          </label>

          <Button
            className="mt-4 w-full"
            variant="destructive"
            disabled={!snapshot || !importStation || !isAdmin || importMut.isPending}
            onClick={() => {
              if (!confirm(`Import snapshot into target station? ${replace ? "This will DELETE existing playlists, schedule, configs and fallback for the target station." : ""}`)) return;
              importMut.mutate();
            }}
          >
            {importMut.isPending ? "Importing…" : replace ? "Replace & Import" : "Merge Import"}
          </Button>
          {!isAdmin && <p className="text-xs text-muted-foreground mt-2">Admin role required to import.</p>}
        </Card>
      </div>
    </AppLayout>
  );
}
