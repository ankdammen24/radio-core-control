import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { listMedia, type ApiMediaFile } from "@/services/mediaApi";
import { ResourcePageShell } from "@/components/resource-page-shell";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { StatusBadge } from "@/components/status-badge";
import { useState, useMemo } from "react";

export const Route = createFileRoute("/media")({ component: MediaPage });

const STATUSES = ["imported", "missing_metadata", "ready", "synced", "error", "paused"];

function MediaPage() {
  const [q, setQ] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");

  const query = useQuery({
    queryKey: ["media-files"],
    queryFn: listMedia,
  });

  const filtered = useMemo(() => {
    return (query.data ?? []).filter((m: ApiMediaFile) => {
      if (statusFilter !== "all" && m.status !== statusFilter) return false;
      if (q) {
        const hay = [m.fileName, m.originalFileName].filter(Boolean).join(" ").toLowerCase();
        if (!hay.includes(q.toLowerCase())) return false;
      }
      return true;
    });
  }, [query.data, q, statusFilter]);

  const state = query.isLoading
    ? { kind: "loading" as const }
    : query.error
      ? {
          kind: "error" as const,
          message: (query.error as Error).message,
          retry: () => query.refetch(),
        }
      : filtered.length === 0
        ? {
            kind: "empty" as const,
            title: query.data?.length ? "Ingen media matchar filtret" : "Ingen media uppladdad ännu",
            hint: query.data?.length
              ? "Justera filtren och försök igen."
              : "Media visas här när Radio Core Backend har fått sitt första objekt.",
          }
        : { kind: "ready" as const };

  return (
    <ResourcePageShell
      title="Media Library"
      description="All audio files across stations."
      searchValue={q}
      onSearchChange={setQ}
      searchPlaceholder="Search file name…"
      filters={
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="h-9 w-40">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All statuses</SelectItem>
            {STATUSES.map((s) => (
              <SelectItem key={s} value={s}>
                {s}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      }
      state={state}
    >
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>File name</TableHead>
            <TableHead>Kind</TableHead>
            <TableHead>Type</TableHead>
            <TableHead>Duration</TableHead>
            <TableHead>Status</TableHead>
            <TableHead>AzuraCast</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {filtered.map((m) => (
            <TableRow key={m.id}>
              <TableCell className="font-medium">{m.fileName}</TableCell>
              <TableCell className="text-muted-foreground">{m.mediaKind}</TableCell>
              <TableCell className="text-muted-foreground">{m.fileType ?? "—"}</TableCell>
              <TableCell className="text-muted-foreground">
                {m.durationSeconds ? `${Math.round(m.durationSeconds)}s` : "—"}
              </TableCell>
              <TableCell>
                <StatusBadge status={m.status} />
              </TableCell>
              <TableCell className="text-xs text-muted-foreground">
                {m.azuracastMediaId ? "synced" : "—"}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </ResourcePageShell>
  );
}
