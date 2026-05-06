import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { AppLayout } from "@/components/app-layout";
import { Card } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { StatusBadge } from "@/components/status-badge";

export const Route = createFileRoute("/metadata/")({ component: MetadataIndex });

function MetadataIndex() {
  const { data, isLoading } = useQuery({
    queryKey: ["metadata-index"],
    queryFn: async () => (await supabase.from("media_files").select("id, file_name, status, track_metadata(artist, title, rights_status, is_local_music, is_ai_generated)").order("created_at", { ascending: false }).limit(300)).data ?? [],
  });
  return (
    <AppLayout title="Track Metadata" description="Edit artist, title, rights, and broadcast flags for each track.">
      <Card className="overflow-hidden">
        <Table>
          <TableHeader><TableRow><TableHead>Title</TableHead><TableHead>Artist</TableHead><TableHead>Rights</TableHead><TableHead>Flags</TableHead><TableHead>Status</TableHead></TableRow></TableHeader>
          <TableBody>
            {isLoading && <TableRow><TableCell colSpan={5} className="text-center text-muted-foreground py-8">Loading…</TableCell></TableRow>}
            {data?.map((m: any) => (
              <TableRow key={m.id}>
                <TableCell className="font-medium"><Link to="/metadata/$id" params={{ id: m.id }} className="hover:underline">{m.track_metadata?.title ?? m.file_name}</Link></TableCell>
                <TableCell>{m.track_metadata?.artist ?? "—"}</TableCell>
                <TableCell>{m.track_metadata?.rights_status ? <StatusBadge status={m.track_metadata.rights_status} /> : "—"}</TableCell>
                <TableCell className="text-xs text-muted-foreground">{[m.track_metadata?.is_local_music && "Local", m.track_metadata?.is_ai_generated && "AI"].filter(Boolean).join(" · ") || "—"}</TableCell>
                <TableCell><StatusBadge status={m.status} /></TableCell>
              </TableRow>
            ))}
            {!isLoading && !data?.length && <TableRow><TableCell colSpan={5} className="text-center text-muted-foreground py-12">No tracks yet.</TableCell></TableRow>}
          </TableBody>
        </Table>
      </Card>
    </AppLayout>
  );
}
