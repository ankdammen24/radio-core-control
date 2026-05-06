import { createFileRoute } from "@tanstack/react-router";
import { AppLayout } from "@/components/app-layout";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Upload, FolderOpen } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { StatusBadge } from "@/components/status-badge";
import { PlaceholderNotice } from "@/components/placeholder-notice";

export const Route = createFileRoute("/files")({ component: FilesPage });

function FilesPage() {
  const { data } = useQuery({
    queryKey: ["files"],
    queryFn: async () => (await supabase.from("media_files").select("*, storage_locations(name, base_path)").order("created_at", { ascending: false }).limit(200)).data ?? [],
  });
  const grouped = (data ?? []).reduce((acc: Record<string, any[]>, m: any) => {
    const key = m.storage_locations?.name ?? "Unassigned";
    (acc[key] ||= []).push(m); return acc;
  }, {});

  return (
    <AppLayout title="File Manager" description="Media folder structure and storage locations." actions={
      <Button size="sm" disabled><Upload className="w-4 h-4 mr-1" />Upload</Button>
    }>
      <PlaceholderNotice title="Direct file upload not yet wired">
        Files are managed by AzuraCast. Once an AzuraCast connection is configured, the <strong>azuracast-list-media</strong> edge function will populate this view from the broadcast server's media library.
      </PlaceholderNotice>

      <div className="mt-4 space-y-4">
        {Object.entries(grouped).map(([loc, files]) => (
          <Card key={loc}>
            <div className="px-5 py-3 border-b border-border flex items-center gap-2">
              <FolderOpen className="w-4 h-4 text-muted-foreground" />
              <span className="font-semibold text-sm">{loc}</span>
              <span className="text-xs text-muted-foreground ml-auto">{(files as any[]).length} files</span>
            </div>
            <Table>
              <TableHeader><TableRow><TableHead>File</TableHead><TableHead>Size</TableHead><TableHead>Type</TableHead><TableHead>Status</TableHead><TableHead>Synced</TableHead></TableRow></TableHeader>
              <TableBody>
                {(files as any[]).slice(0, 25).map((m) => (
                  <TableRow key={m.id}>
                    <TableCell className="font-mono text-xs">{m.file_name}</TableCell>
                    <TableCell className="text-muted-foreground">{m.file_size ? `${(m.file_size/1024/1024).toFixed(1)} MB` : "—"}</TableCell>
                    <TableCell className="text-muted-foreground">{m.file_type ?? m.mime_type ?? "—"}</TableCell>
                    <TableCell><StatusBadge status={m.status} /></TableCell>
                    <TableCell>{m.azuracast_media_id ? <StatusBadge status="synced" /> : <span className="text-xs text-muted-foreground">—</span>}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </Card>
        ))}
        {!Object.keys(grouped).length && <Card className="p-8 text-center text-muted-foreground text-sm">No files yet.</Card>}
      </div>
    </AppLayout>
  );
}
