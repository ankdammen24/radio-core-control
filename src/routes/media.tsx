import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { AppLayout } from "@/components/app-layout";
import { Card } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { StatusBadge } from "@/components/status-badge";
import { Search } from "lucide-react";
import { useState, useMemo } from "react";

export const Route = createFileRoute("/media")({ component: MediaPage });

function MediaPage() {
  const [q, setQ] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [rightsFilter, setRightsFilter] = useState<string>("all");

  const { data: stations } = useQuery({ queryKey: ["stations-list"], queryFn: async () => (await supabase.from("stations").select("id,name")).data ?? [] });
  const [stationFilter, setStationFilter] = useState<string>("all");

  const { data, isLoading } = useQuery({
    queryKey: ["media-files"],
    queryFn: async () => (await supabase.from("media_files").select("*, track_metadata(*), stations(name)").order("created_at", { ascending: false }).limit(500)).data ?? [],
  });

  const filtered = useMemo(() => {
    return (data ?? []).filter((m: any) => {
      const md = m.track_metadata;
      if (statusFilter !== "all" && m.status !== statusFilter) return false;
      if (stationFilter !== "all" && m.station_id !== stationFilter) return false;
      if (rightsFilter !== "all" && md?.rights_status !== rightsFilter) return false;
      if (q) {
        const hay = [m.file_name, md?.artist, md?.title, md?.genre].filter(Boolean).join(" ").toLowerCase();
        if (!hay.includes(q.toLowerCase())) return false;
      }
      return true;
    });
  }, [data, q, statusFilter, rightsFilter, stationFilter]);

  return (
    <AppLayout title="Media Library" description="All media files across stations.">
      <Card className="p-4 mb-4">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
          <div className="relative">
            <Search className="w-4 h-4 absolute left-3 top-2.5 text-muted-foreground" />
            <Input className="pl-9" placeholder="Search artist, title, genre…" value={q} onChange={(e) => setQ(e.target.value)} />
          </div>
          <Select value={stationFilter} onValueChange={setStationFilter}>
            <SelectTrigger><SelectValue placeholder="Station" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All stations</SelectItem>
              {stations?.map((s) => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger><SelectValue placeholder="Status" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All statuses</SelectItem>
              {["imported","missing_metadata","ready","synced","error","paused"].map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select value={rightsFilter} onValueChange={setRightsFilter}>
            <SelectTrigger><SelectValue placeholder="Rights" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All rights</SelectItem>
              {["unknown","cleared","ai_generated","local_permission","creative_commons","needs_review","blocked"].map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
      </Card>

      <Card className="overflow-hidden">
        <Table>
          <TableHeader><TableRow>
            <TableHead>Title</TableHead><TableHead>Artist</TableHead><TableHead>Genre</TableHead>
            <TableHead>Station</TableHead><TableHead>Status</TableHead><TableHead>Rights</TableHead><TableHead>Tags</TableHead>
          </TableRow></TableHeader>
          <TableBody>
            {isLoading && <TableRow><TableCell colSpan={7} className="text-center text-muted-foreground py-8">Loading…</TableCell></TableRow>}
            {filtered.map((m: any) => {
              const md = m.track_metadata;
              return (
                <TableRow key={m.id}>
                  <TableCell className="font-medium"><Link to="/metadata/$id" params={{ id: m.id }} className="hover:underline">{md?.title ?? m.file_name}</Link></TableCell>
                  <TableCell>{md?.artist ?? "—"}</TableCell>
                  <TableCell className="text-muted-foreground">{md?.genre ?? "—"}</TableCell>
                  <TableCell className="text-muted-foreground">{m.stations?.name ?? "—"}</TableCell>
                  <TableCell><StatusBadge status={m.status} /></TableCell>
                  <TableCell>{md?.rights_status && <StatusBadge status={md.rights_status} />}</TableCell>
                  <TableCell className="text-xs text-muted-foreground">
                    {md?.is_local_music && "Local "}{md?.is_ai_generated && "AI"}
                  </TableCell>
                </TableRow>
              );
            })}
            {!isLoading && !filtered.length && <TableRow><TableCell colSpan={7} className="text-center text-muted-foreground py-12">No media files match these filters.</TableCell></TableRow>}
          </TableBody>
        </Table>
      </Card>
    </AppLayout>
  );
}
