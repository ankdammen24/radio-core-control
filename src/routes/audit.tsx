import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { AppLayout } from "@/components/app-layout";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { useState, useMemo, useEffect, useRef } from "react";
import { RefreshCw } from "lucide-react";

export const Route = createFileRoute("/audit")({ component: AuditPage });

function AuditPage() {
  const [q, setQ] = useState("");
  const qc = useQueryClient();
  const { data, isLoading, refetch, isFetching, dataUpdatedAt } = useQuery({
    queryKey:["audit_logs"],
    queryFn: async () => (await supabase.from("audit_logs").select("*").order("created_at", { ascending: false }).limit(500)).data ?? [],
    refetchInterval: 5000,
    refetchOnWindowFocus: true,
  });

  const lastSeenIdRef = useRef<string | null>(null);
  const [highlightedIds, setHighlightedIds] = useState<Set<string>>(new Set());
  useEffect(() => {
    if (!data || data.length === 0) return;
    const newest = (data[0] as any).id as string;
    if (lastSeenIdRef.current && lastSeenIdRef.current !== newest) {
      const fresh = new Set<string>();
      for (const row of data as any[]) {
        if (row.id === lastSeenIdRef.current) break;
        fresh.add(row.id);
      }
      if (fresh.size) {
        setHighlightedIds((prev) => new Set([...prev, ...fresh]));
        setTimeout(() => {
          setHighlightedIds((prev) => {
            const next = new Set(prev);
            for (const id of fresh) next.delete(id);
            return next;
          });
        }, 4000);
      }
    }
    lastSeenIdRef.current = newest;
  }, [data]);

  useEffect(() => {
    const channel = supabase
      .channel("audit_logs_changes")
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "audit_logs" }, () => {
        qc.invalidateQueries({ queryKey: ["audit_logs"] });
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [qc]);
  const filtered = useMemo(() => (data ?? []).filter((a: any) =>
    !q || [a.action, a.entity_type, a.entity_id].filter(Boolean).join(" ").toLowerCase().includes(q.toLowerCase())
  ), [data, q]);

  return (
    <AppLayout title="Audit Logs" description="Important actions performed in Radio Core.">
      <Card className="p-3 mb-4 flex flex-col gap-2 sm:flex-row sm:items-center">
        <Input placeholder="Filter by action, entity type, ID…" value={q} onChange={(e) => setQ(e.target.value)} className="flex-1" />
        <div className="flex items-center gap-2">
          <span className="text-xs text-muted-foreground tabular-nums">
            {dataUpdatedAt ? `Updated ${new Date(dataUpdatedAt).toLocaleTimeString()}` : "—"}
          </span>
          <Button size="sm" variant="outline" onClick={() => refetch()} disabled={isFetching}>
            <RefreshCw className={`h-3.5 w-3.5 mr-1 ${isFetching ? "animate-spin" : ""}`} /> Refresh
          </Button>
        </div>
      </Card>
      <Card className="overflow-hidden">
        <Table>
          <TableHeader><TableRow><TableHead>When</TableHead><TableHead>Action</TableHead><TableHead>Entity</TableHead><TableHead>Details</TableHead><TableHead>User</TableHead></TableRow></TableHeader>
          <TableBody>
            {isLoading && <TableRow><TableCell colSpan={5} className="text-center text-muted-foreground py-8">Loading…</TableCell></TableRow>}
            {filtered.map((a: any) => {
              const isNew = highlightedIds.has(a.id);
              const isBroadcast = a.action === "news.broadcasted";
              const nv = a.new_value ?? {};
              return (
                <TableRow key={a.id} className={isNew ? "bg-primary/10 transition-colors" : ""}>
                  <TableCell className="text-xs text-muted-foreground tabular-nums whitespace-nowrap">{new Date(a.created_at).toLocaleString()}</TableCell>
                  <TableCell className="font-medium">
                    <span className="inline-flex items-center gap-2">
                      {a.action}
                      {isNew && <Badge variant="default" className="text-[10px]">NEW</Badge>}
                    </span>
                  </TableCell>
                  <TableCell className="text-muted-foreground text-xs">{a.entity_type ?? "—"} {a.entity_id ? `· ${String(a.entity_id).slice(0,8)}` : ""}</TableCell>
                  <TableCell className="text-xs text-muted-foreground max-w-xs truncate">
                    {isBroadcast
                      ? `${nv.stationSlug ?? nv.stationId ?? "?"}${nv.programName ? ` · ${nv.programName}` : ""}${nv.broadcastTime ? ` · ${new Date(nv.broadcastTime).toLocaleTimeString()}` : ""}`
                      : "—"}
                  </TableCell>
                  <TableCell className="text-xs font-mono text-muted-foreground">{a.user_id ? String(a.user_id).slice(0,8) : "system"}</TableCell>
                </TableRow>
              );
            })}
            {!isLoading && !filtered.length && <TableRow><TableCell colSpan={5} className="text-center text-muted-foreground py-12">No audit entries.</TableCell></TableRow>}
          </TableBody>
        </Table>
      </Card>
    </AppLayout>
  );
}
