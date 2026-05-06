import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { AppLayout } from "@/components/app-layout";
import { Card } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { StatusBadge } from "@/components/status-badge";
import { RefreshCw } from "lucide-react";
import { useAuth } from "@/lib/auth";
import { toast } from "sonner";

export const Route = createFileRoute("/sync-jobs")({ component: SyncJobsPage });

function SyncJobsPage() {
  const qc = useQueryClient();
  const { isEditor } = useAuth();
  const { data, isLoading } = useQuery({
    queryKey:["sync_jobs"],
    queryFn: async () => (await supabase.from("sync_jobs").select("*, stations(name)").order("created_at", { ascending: false }).limit(200)).data ?? [],
  });
  const retry = useMutation({
    mutationFn: async (j: any) => {
      const { error } = await supabase.from("sync_jobs").insert({ station_id: j.station_id, job_type: j.job_type, status: "pending", payload: j.payload });
      if (error) throw error;
    },
    onSuccess: () => { toast.success("Re-queued"); qc.invalidateQueries({ queryKey:["sync_jobs"] }); },
  });

  return (
    <AppLayout title="Sync Jobs" description="Background sync between Radio Core and AzuraCast.">
      <Card className="overflow-hidden">
        <Table>
          <TableHeader><TableRow><TableHead>Created</TableHead><TableHead>Type</TableHead><TableHead>Station</TableHead><TableHead>Status</TableHead><TableHead>Message</TableHead><TableHead className="w-24" /></TableRow></TableHeader>
          <TableBody>
            {isLoading && <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground py-8">Loading…</TableCell></TableRow>}
            {data?.map((j: any) => (
              <TableRow key={j.id}>
                <TableCell className="text-xs text-muted-foreground tabular-nums">{new Date(j.created_at).toLocaleString()}</TableCell>
                <TableCell className="font-mono text-xs">{j.job_type}</TableCell>
                <TableCell className="text-muted-foreground">{j.stations?.name ?? "—"}</TableCell>
                <TableCell><StatusBadge status={j.status} /></TableCell>
                <TableCell className="text-xs text-muted-foreground max-w-md truncate">{j.message ?? "—"}</TableCell>
                <TableCell>{isEditor && j.status === "failed" && <Button variant="ghost" size="sm" onClick={() => retry.mutate(j)}><RefreshCw className="w-4 h-4 mr-1" />Retry</Button>}</TableCell>
              </TableRow>
            ))}
            {!isLoading && !data?.length && <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground py-12">No sync jobs yet.</TableCell></TableRow>}
          </TableBody>
        </Table>
      </Card>
    </AppLayout>
  );
}
