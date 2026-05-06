import { Badge } from "@/components/ui/badge";
import type { Database } from "@/integrations/supabase/types";

type MediaStatus = Database["public"]["Enums"]["media_status"];
type RightsStatus = Database["public"]["Enums"]["rights_status"];
type SyncStatus = Database["public"]["Enums"]["sync_job_status"];
type ConnStatus = Database["public"]["Enums"]["connection_status"];

export function StatusBadge({ status }: { status: MediaStatus | RightsStatus | SyncStatus | ConnStatus | string }) {
  const map: Record<string, { label: string; cls: string }> = {
    // media
    imported: { label: "Imported", cls: "bg-info/15 text-info border-info/30" },
    missing_metadata: { label: "Missing Metadata", cls: "bg-warning/15 text-warning border-warning/30" },
    ready: { label: "Ready", cls: "bg-secondary text-secondary-foreground border-border" },
    synced: { label: "Synced", cls: "bg-success/15 text-success border-success/30" },
    error: { label: "Error", cls: "bg-destructive/15 text-destructive border-destructive/30" },
    paused: { label: "Paused", cls: "bg-muted text-muted-foreground border-border" },
    // rights
    unknown: { label: "Unknown", cls: "bg-muted text-muted-foreground border-border" },
    cleared: { label: "Cleared", cls: "bg-success/15 text-success border-success/30" },
    ai_generated: { label: "AI Generated", cls: "bg-info/15 text-info border-info/30" },
    local_permission: { label: "Local Permission", cls: "bg-success/15 text-success border-success/30" },
    creative_commons: { label: "Creative Commons", cls: "bg-info/15 text-info border-info/30" },
    needs_review: { label: "Needs Review", cls: "bg-warning/15 text-warning border-warning/30" },
    blocked: { label: "Blocked", cls: "bg-destructive/15 text-destructive border-destructive/30" },
    // sync
    pending: { label: "Pending", cls: "bg-muted text-muted-foreground border-border" },
    running: { label: "Running", cls: "bg-info/15 text-info border-info/30" },
    completed: { label: "Completed", cls: "bg-success/15 text-success border-success/30" },
    failed: { label: "Failed", cls: "bg-destructive/15 text-destructive border-destructive/30" },
    // conn
    untested: { label: "Untested", cls: "bg-muted text-muted-foreground border-border" },
    ok: { label: "OK", cls: "bg-success/15 text-success border-success/30" },
  };
  const m = map[status] ?? { label: String(status), cls: "bg-muted text-muted-foreground border-border" };
  return <Badge variant="outline" className={`font-medium uppercase tracking-wide text-[10px] ${m.cls}`}>{m.label}</Badge>;
}
