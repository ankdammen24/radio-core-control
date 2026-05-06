import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { AppLayout } from "@/components/app-layout";
import { Card } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { useState, useMemo } from "react";

export const Route = createFileRoute("/audit")({ component: AuditPage });

function AuditPage() {
  const [q, setQ] = useState("");
  const { data, isLoading } = useQuery({
    queryKey:["audit_logs"],
    queryFn: async () => (await supabase.from("audit_logs").select("*").order("created_at", { ascending: false }).limit(500)).data ?? [],
  });
  const filtered = useMemo(() => (data ?? []).filter((a: any) =>
    !q || [a.action, a.entity_type, a.entity_id].filter(Boolean).join(" ").toLowerCase().includes(q.toLowerCase())
  ), [data, q]);

  return (
    <AppLayout title="Audit Logs" description="Important actions performed in Radio Core.">
      <Card className="p-3 mb-4"><Input placeholder="Filter by action, entity type, ID…" value={q} onChange={(e) => setQ(e.target.value)} /></Card>
      <Card className="overflow-hidden">
        <Table>
          <TableHeader><TableRow><TableHead>When</TableHead><TableHead>Action</TableHead><TableHead>Entity</TableHead><TableHead>User</TableHead></TableRow></TableHeader>
          <TableBody>
            {isLoading && <TableRow><TableCell colSpan={4} className="text-center text-muted-foreground py-8">Loading…</TableCell></TableRow>}
            {filtered.map((a: any) => (
              <TableRow key={a.id}>
                <TableCell className="text-xs text-muted-foreground tabular-nums">{new Date(a.created_at).toLocaleString()}</TableCell>
                <TableCell className="font-medium">{a.action}</TableCell>
                <TableCell className="text-muted-foreground text-xs">{a.entity_type ?? "—"} {a.entity_id ? `· ${String(a.entity_id).slice(0,8)}` : ""}</TableCell>
                <TableCell className="text-xs font-mono text-muted-foreground">{a.user_id ? String(a.user_id).slice(0,8) : "—"}</TableCell>
              </TableRow>
            ))}
            {!isLoading && !filtered.length && <TableRow><TableCell colSpan={4} className="text-center text-muted-foreground py-12">No audit entries.</TableCell></TableRow>}
          </TableBody>
        </Table>
      </Card>
    </AppLayout>
  );
}
