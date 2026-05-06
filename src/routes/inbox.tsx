import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { AppLayout } from "@/components/app-layout";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/data-states";
import { MessageSquare, Music2, Check, ExternalLink } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/inbox")({ component: InboxPage });

function InboxPage() {
  const qc = useQueryClient();
  const requests = useQuery({
    queryKey: ["song-requests"], refetchInterval: 15_000,
    queryFn: async () => (await supabase.from("song_requests").select("*, stations(name)").order("created_at", { ascending: false }).limit(100)).data ?? [],
  });
  const messages = useQuery({
    queryKey: ["studio-messages"], refetchInterval: 15_000,
    queryFn: async () => (await supabase.from("studio_messages").select("*, stations(name)").order("created_at", { ascending: false }).limit(100)).data ?? [],
  });

  const setStatus = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: string }) => {
      const { error } = await supabase.from("song_requests").update({ status }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => { toast.success("Updated"); qc.invalidateQueries({ queryKey: ["song-requests"] }); },
  });
  const handleMsg = useMutation({
    mutationFn: async (id: string) => { const { error } = await supabase.from("studio_messages").update({ handled: true }).eq("id", id); if (error) throw error; },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["studio-messages"] }),
  });

  return (
    <AppLayout
      title="Studio Inbox"
      description="Lyssnarinteraktion: låtönskningar och meddelanden in till studion"
      actions={<Button asChild variant="outline"><Link to="/companion"><ExternalLink className="w-4 h-4 mr-2" /> Open companion</Link></Button>}
    >
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card className="p-4">
          <h2 className="text-sm font-semibold mb-3 flex items-center gap-2"><Music2 className="w-4 h-4" /> Song requests</h2>
          <div className="divide-y divide-border max-h-[70vh] overflow-y-auto">
            {(requests.data ?? []).length === 0 && <EmptyState title="No requests yet" />}
            {(requests.data ?? []).map((r: any) => (
              <div key={r.id} className="py-3">
                <div className="flex items-center justify-between">
                  <div className="font-medium">{r.track_text}</div>
                  <Badge variant={r.status === "played" ? "default" : r.status === "rejected" ? "destructive" : "secondary"}>{r.status}</Badge>
                </div>
                <div className="text-xs text-muted-foreground mt-0.5">
                  {r.requester_name ?? "Anonymous"} · {r.stations?.name} · {new Date(r.created_at).toLocaleString()}
                </div>
                {r.message && <div className="text-sm mt-1 italic">"{r.message}"</div>}
                <div className="flex gap-2 mt-2">
                  <Button size="sm" variant="outline" onClick={() => setStatus.mutate({ id: r.id, status: "approved" })}>Approve</Button>
                  <Button size="sm" variant="outline" onClick={() => setStatus.mutate({ id: r.id, status: "played" })}>Mark played</Button>
                  <Button size="sm" variant="ghost" onClick={() => setStatus.mutate({ id: r.id, status: "rejected" })}>Reject</Button>
                </div>
              </div>
            ))}
          </div>
        </Card>

        <Card className="p-4">
          <h2 className="text-sm font-semibold mb-3 flex items-center gap-2"><MessageSquare className="w-4 h-4" /> Studio messages</h2>
          <div className="divide-y divide-border max-h-[70vh] overflow-y-auto">
            {(messages.data ?? []).length === 0 && <EmptyState title="No messages yet" />}
            {(messages.data ?? []).map((m: any) => (
              <div key={m.id} className="py-3">
                <div className="flex items-center justify-between">
                  <div className="font-medium">{m.from_name ?? "Anonymous"} <Badge variant="outline" className="ml-1 text-[10px]">{m.kind}</Badge></div>
                  {m.handled
                    ? <Badge variant="default">handled</Badge>
                    : <Button size="sm" variant="ghost" onClick={() => handleMsg.mutate(m.id)}><Check className="w-3 h-3 mr-1" /> Mark handled</Button>}
                </div>
                <div className="text-sm mt-1">{m.body}</div>
                <div className="text-xs text-muted-foreground mt-0.5">{m.stations?.name} · {new Date(m.created_at).toLocaleString()}</div>
              </div>
            ))}
          </div>
        </Card>
      </div>
    </AppLayout>
  );
}
