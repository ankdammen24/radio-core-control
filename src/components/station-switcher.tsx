/**
 * Station switcher — surfaces the active station scope.
 *
 * Multi-station ready: lists all visible stations and supports an
 * "All stations" mode (super-admin overview). White-label safe — never
 * renders hardcoded brand copy; everything comes from station data.
 */
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel,
  DropdownMenuSeparator, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Radio, ChevronsUpDown, Check, Globe } from "lucide-react";
import { useStationScope } from "@/lib/station-context";

function brandInitial(name: string) {
  return name.trim().charAt(0).toUpperCase() || "·";
}

export function StationSwitcher({ allowAll = false }: { allowAll?: boolean }) {
  const { scope, stations, setActiveStationId, loading } = useStationScope();

  const label =
    scope.kind === "all" ? "All stations" :
    scope.kind === "station" ? scope.station.name :
    loading ? "Loading…" : "No station";

  const sublabel =
    scope.kind === "all" ? `${stations.length} stations` :
    scope.kind === "station" ? (scope.station.accountName ?? scope.station.slug) :
    "Create one to get started";

  const initial =
    scope.kind === "station" ? brandInitial(scope.station.name) : null;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          className="w-full flex items-center gap-2 rounded-md border border-sidebar-border bg-sidebar-accent/30 px-2.5 py-2 text-left hover:bg-sidebar-accent/60 transition-colors"
        >
          <div className="w-8 h-8 rounded bg-sidebar-primary text-sidebar-primary-foreground flex items-center justify-center text-sm font-semibold shrink-0">
            {scope.kind === "all" ? <Globe className="w-4 h-4" /> : initial ?? <Radio className="w-4 h-4" />}
          </div>
          <div className="min-w-0 flex-1">
            <div className="text-sm font-medium truncate text-sidebar-foreground">{label}</div>
            <div className="text-[10px] uppercase tracking-wider text-sidebar-foreground/60 truncate">{sublabel}</div>
          </div>
          <ChevronsUpDown className="w-4 h-4 text-sidebar-foreground/60 shrink-0" />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-64">
        <DropdownMenuLabel className="text-xs text-muted-foreground">Stations</DropdownMenuLabel>
        {stations.length === 0 && (
          <div className="px-2 py-3 text-xs text-muted-foreground">No stations yet.</div>
        )}
        {stations.map((s) => {
          const active = scope.kind === "station" && scope.station.id === s.id;
          return (
            <DropdownMenuItem key={s.id} onSelect={() => setActiveStationId(s.id)} className="gap-2">
              <div className="w-6 h-6 rounded bg-muted text-muted-foreground flex items-center justify-center text-xs font-semibold">
                {brandInitial(s.name)}
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-sm truncate">{s.name}</div>
                <div className="text-[10px] text-muted-foreground truncate">{s.accountName ?? s.slug}</div>
              </div>
              {active && <Check className="w-3.5 h-3.5 text-success" />}
            </DropdownMenuItem>
          );
        })}
        {allowAll && stations.length > 1 && (
          <>
            <DropdownMenuSeparator />
            <DropdownMenuItem onSelect={() => setActiveStationId("all")} className="gap-2">
              <div className="w-6 h-6 rounded bg-muted text-muted-foreground flex items-center justify-center">
                <Globe className="w-3.5 h-3.5" />
              </div>
              <div className="flex-1">
                <div className="text-sm">All stations</div>
                <div className="text-[10px] text-muted-foreground">Super-admin overview</div>
              </div>
              {scope.kind === "all" && <Check className="w-3.5 h-3.5 text-success" />}
            </DropdownMenuItem>
          </>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
