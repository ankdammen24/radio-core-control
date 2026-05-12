/**
 * Unified sync status badge for any synchronizable entity in Radio Core.
 *
 * Use this everywhere a row, card or detail view represents an entity that
 * is mirrored between Radio Core (control plane) and AzuraCast / runtime
 * (runtime plane). Keeps language consistent across resource pages.
 */
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import {
  Check, Clock, CircleDot, UploadCloud, AlertTriangle, AlertOctagon, Database, Cloud,
  type LucideIcon,
} from "lucide-react";

export type SyncStatus =
  | "synced"
  | "pending"
  | "dirty"
  | "pushing"
  | "failed"
  | "conflict"
  | "local_only"
  | "external_only";

const MAP: Record<SyncStatus, { label: string; icon: LucideIcon; cls: string; hint: string }> = {
  synced:        { label: "Synced",        icon: Check,        cls: "bg-success/15 text-success border-success/30",         hint: "In sync with runtime" },
  pending:       { label: "Pending",       icon: Clock,        cls: "bg-muted text-muted-foreground border-border",          hint: "Queued for sync" },
  dirty:         { label: "Dirty",         icon: CircleDot,    cls: "bg-warning/15 text-warning border-warning/30",          hint: "Local changes not yet pushed" },
  pushing:       { label: "Pushing",       icon: UploadCloud,  cls: "bg-info/15 text-info border-info/30",                   hint: "Syncing to runtime now" },
  failed:        { label: "Failed",        icon: AlertOctagon, cls: "bg-destructive/15 text-destructive border-destructive/30", hint: "Last sync attempt failed" },
  conflict:      { label: "Conflict",      icon: AlertTriangle, cls: "bg-destructive/15 text-destructive border-destructive/30", hint: "Local and runtime diverged" },
  local_only:    { label: "Local only",    icon: Database,     cls: "bg-secondary text-secondary-foreground border-border",  hint: "Exists in Radio Core only" },
  external_only: { label: "Runtime only",  icon: Cloud,        cls: "bg-secondary text-secondary-foreground border-border",  hint: "Exists in runtime only — not yet imported" },
};

export function SyncStatusBadge({
  status, className, showIcon = true, compact = false,
}: {
  status: SyncStatus;
  className?: string;
  showIcon?: boolean;
  compact?: boolean;
}) {
  const m = MAP[status];
  const Icon = m.icon;
  return (
    <Badge
      variant="outline"
      title={m.hint}
      className={cn(
        "font-medium uppercase tracking-wide gap-1",
        compact ? "text-[10px] px-1.5 py-0" : "text-[10px]",
        m.cls,
        className,
      )}
    >
      {showIcon && <Icon className="w-3 h-3" />}
      {m.label}
    </Badge>
  );
}

export const SYNC_STATUS_LIST: SyncStatus[] = [
  "synced", "pending", "dirty", "pushing", "failed", "conflict", "local_only", "external_only",
];
