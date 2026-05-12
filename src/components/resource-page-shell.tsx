/**
 * ResourcePageShell — common layout for entity-list pages.
 *
 * Owns the full page chrome (AppLayout + toolbar + state machine) so each
 * resource page only supplies data, filters, actions and the row body.
 *
 * One reusable shell for: Media, Playlists, Voicetracks, Ads, Shows,
 * Episodes, Storage, Configs, Sync Jobs, Health, Streamers, Podcasts,
 * Mountpoints, Webhooks, Relays, Presenters, etc.
 */
import { type ReactNode } from "react";
import { AppLayout } from "@/components/app-layout";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Search, Loader2, AlertOctagon, Inbox } from "lucide-react";
import { cn } from "@/lib/utils";
import { useStationScope } from "@/lib/station-context";

export type ResourceState =
  | { kind: "ready" }
  | { kind: "loading" }
  | { kind: "empty"; title?: string; hint?: string; action?: ReactNode }
  | { kind: "error"; message: string; retry?: () => void };

export function ResourcePageShell({
  title, description,
  actions, primaryAction,
  searchValue, onSearchChange, searchPlaceholder = "Search…",
  filters, bulkActions, syncSummary, drawer,
  state = { kind: "ready" },
  children,
  hideStationScope = false,
  wrapContent = true,
}: {
  title: string;
  description?: string;
  /** Header-level actions in the AppLayout bar (right side). */
  actions?: ReactNode;
  /** Primary CTA shown next to the resource sub-title. */
  primaryAction?: ReactNode;
  searchValue?: string;
  onSearchChange?: (v: string) => void;
  searchPlaceholder?: string;
  filters?: ReactNode;
  bulkActions?: ReactNode;
  syncSummary?: ReactNode;
  drawer?: ReactNode;
  state?: ResourceState;
  children: ReactNode;
  hideStationScope?: boolean;
  /** When false, children render outside the framed Card (for custom layouts). */
  wrapContent?: boolean;
}) {
  const { scope } = useStationScope();
  const scopeLabel =
    scope.kind === "station" ? scope.station.name :
    scope.kind === "all" ? "All stations" : "No station";

  const showToolbar = Boolean(onSearchChange || filters || primaryAction || !hideStationScope);

  const body =
    state.kind === "loading" ? <ResourceLoading /> :
    state.kind === "empty" ? <ResourceEmpty title={state.title} hint={state.hint} action={state.action} /> :
    state.kind === "error" ? <ResourceError message={state.message} retry={state.retry} /> :
    children;

  return (
    <AppLayout title={title} description={description} actions={actions}>
      <div className="flex gap-6">
        <div className="flex-1 min-w-0 space-y-4">
          {showToolbar && (
            <div className="flex flex-wrap items-center gap-2">
              {!hideStationScope && (
                <Badge variant="outline" className="text-[10px] uppercase tracking-wider">
                  {scopeLabel}
                </Badge>
              )}
              {onSearchChange && (
                <div className="relative flex-1 min-w-[220px] max-w-md">
                  <Search className="w-4 h-4 absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    value={searchValue ?? ""}
                    onChange={(e) => onSearchChange(e.target.value)}
                    placeholder={searchPlaceholder}
                    className="pl-8 h-9"
                  />
                </div>
              )}
              {filters && <div className="flex flex-wrap items-center gap-2">{filters}</div>}
              {primaryAction && <div className="ml-auto shrink-0">{primaryAction}</div>}
            </div>
          )}

          {bulkActions && (
            <div className="flex items-center justify-between gap-2 rounded-md border border-border bg-muted/40 px-3 py-2">
              <div className="text-xs text-muted-foreground">Bulk actions</div>
              <div className="flex items-center gap-2">{bulkActions}</div>
            </div>
          )}

          {wrapContent ? (
            <Card className={cn("p-0 overflow-hidden", state.kind === "loading" && "opacity-70")}>
              {body}
            </Card>
          ) : body}

          {syncSummary && (
            <Card className="p-3 text-xs text-muted-foreground flex flex-wrap gap-3 items-center">
              <span className="uppercase tracking-wider">Sync</span>
              {syncSummary}
            </Card>
          )}
        </div>
        {drawer && <aside className="w-[380px] shrink-0">{drawer}</aside>}
      </div>
    </AppLayout>
  );
}

function ResourceLoading() {
  return (
    <div className="p-12 flex flex-col items-center gap-3 text-muted-foreground">
      <Loader2 className="w-5 h-5 animate-spin" />
      <div className="text-sm">Loading…</div>
    </div>
  );
}

function ResourceEmpty({ title, hint, action }: { title?: string; hint?: string; action?: ReactNode }) {
  return (
    <div className="p-12 flex flex-col items-center gap-3 text-center">
      <div className="w-10 h-10 rounded-full bg-muted flex items-center justify-center">
        <Inbox className="w-5 h-5 text-muted-foreground" />
      </div>
      <div className="text-sm font-medium">{title ?? "Nothing here yet"}</div>
      {hint && <div className="text-xs text-muted-foreground max-w-sm">{hint}</div>}
      {action}
    </div>
  );
}

function ResourceError({ message, retry }: { message: string; retry?: () => void }) {
  return (
    <div className="p-12 flex flex-col items-center gap-3 text-center">
      <div className="w-10 h-10 rounded-full bg-destructive/10 flex items-center justify-center">
        <AlertOctagon className="w-5 h-5 text-destructive" />
      </div>
      <div className="text-sm font-medium">Something went wrong</div>
      <div className="text-xs text-muted-foreground max-w-sm">{message}</div>
      {retry && <Button size="sm" variant="outline" onClick={retry}>Retry</Button>}
    </div>
  );
}
