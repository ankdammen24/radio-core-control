import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { AppLayout } from "@/components/app-layout";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { useState, useEffect } from "react";
import { useAuth } from "@/lib/auth";
import { toast } from "sonner";

export const Route = createFileRoute("/settings")({ component: SettingsPage });

function SettingsPage() {
  const qc = useQueryClient();
  const { isAdmin } = useAuth();
  const { data } = useQuery({ queryKey:["system_settings"], queryFn: async () => (await supabase.from("system_settings").select("*").order("key")).data ?? [] });
  const [drafts, setDrafts] = useState<Record<string, string>>({});

  useEffect(() => {
    if (data) setDrafts(Object.fromEntries(data.map((s: any) => [s.id, JSON.stringify(s.value, null, 2)])));
  }, [data]);

  const save = useMutation({
    mutationFn: async ({ id, raw }: { id: string; raw: string }) => {
      let parsed; try { parsed = JSON.parse(raw); } catch { throw new Error("Invalid JSON"); }
      const { error } = await supabase.from("system_settings").update({ value: parsed }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => { toast.success("Saved"); qc.invalidateQueries({ queryKey:["system_settings"] }); },
    onError: (e: any) => toast.error(e.message),
  });

  return (
    <AppLayout title="System Settings" description="Global Radio Core configuration.">
      {!isAdmin && <Card className="p-4 mb-4 border-warning/40 bg-warning/10 text-sm">Admin role required to edit system settings.</Card>}
      <div className="space-y-4">
        {data?.map((s: any) => (
          <Card key={s.id} className="p-5">
            <div className="flex items-baseline justify-between mb-1">
              <Label className="font-mono text-sm">{s.key}</Label>
            </div>
            {s.description && <p className="text-xs text-muted-foreground mb-3">{s.description}</p>}
            <Textarea className="font-mono text-xs" rows={4} value={drafts[s.id] ?? ""} disabled={!isAdmin} onChange={(e) => setDrafts({ ...drafts, [s.id]: e.target.value })} />
            {isAdmin && <div className="mt-3"><Button size="sm" onClick={() => save.mutate({ id: s.id, raw: drafts[s.id] })} disabled={save.isPending}>Save</Button></div>}
          </Card>
        ))}
      </div>
    </AppLayout>
  );
}
