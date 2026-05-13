/**
 * Topbar — global app chrome above the page content.
 *
 * Hosts: mobile menu trigger, page title slot, station switcher,
 * runtime status pill (live health rollup), theme toggle, and a
 * user/account menu. White-label safe — no station-specific copy.
 */
import { useQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { Menu, Moon, Sun, LogOut, User, Settings, Activity, Radio } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel,
  DropdownMenuSeparator, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { StationSwitcher } from "@/components/station-switcher";
import { useAuth } from "@/lib/auth";
import { useTheme } from "@/lib/theme";
import { useStationScope } from "@/lib/station-context";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";
import type { ReactNode } from "react";

export function Topbar({
  title, description, actions, onOpenMobileNav,
}: {
  title: string;
  description?: string;
  actions?: ReactNode;
  onOpenMobileNav: () => void;
}) {
  return (
    <header className="border-b border-border bg-card/60 backdrop-blur-md sticky top-0 z-30">
      <div className="px-4 lg:px-8 h-14 flex items-center gap-3">
        <Button
          variant="ghost"
          size="icon"
          className="lg:hidden -ml-1"
          onClick={onOpenMobileNav}
          aria-label="Open navigation"
        >
          <Menu className="w-5 h-5" />
        </Button>

        <div className="min-w-0 flex-1">
          <h1 className="text-base font-semibold tracking-tight truncate">{title}</h1>
          {description && (
            <p className="text-xs text-muted-foreground truncate">{description}</p>
          )}
        </div>

        <div className="hidden md:block w-56">
          <StationSwitcher allowAll />
        </div>

        <RuntimeStatusPill />

        {actions && <div className="hidden md:flex items-center gap-2">{actions}</div>}

        <ThemeToggle />
        <UserMenu />
      </div>

      {actions && (
        <div className="md:hidden border-t border-border px-4 py-2 flex items-center gap-2 overflow-x-auto">
          {actions}
        </div>
      )}
    </header>
  );
}

function ThemeToggle() {
  const { theme, toggle } = useTheme();
  return (
    <Button variant="ghost" size="icon" onClick={toggle} aria-label="Toggle theme">
      {theme === "dark" ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
    </Button>
  );
}

function UserMenu() {
  const { user, roles, signOut } = useAuth();
  const initial = (user?.email?.[0] ?? "?").toUpperCase();
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          className="flex items-center gap-2 rounded-full border border-border bg-muted/40 hover:bg-muted transition-colors pl-1 pr-2 py-1"
          aria-label="Account menu"
        >
          <div className="w-7 h-7 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-xs font-semibold">
            {initial}
          </div>
          <span className="hidden md:block text-xs text-muted-foreground max-w-[120px] truncate">
            {user?.email ?? "Operator"}
          </span>
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56">
        <DropdownMenuLabel className="space-y-0.5">
          <div className="text-sm truncate">{user?.email ?? "Unknown operator"}</div>
          <div className="text-[10px] uppercase tracking-wider text-muted-foreground">
            {roles.join(" · ") || "no role"}
          </div>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem asChild>
          <Link to={"/settings" as "/"} className="flex items-center gap-2">
            <Settings className="w-4 h-4" /> Settings
          </Link>
        </DropdownMenuItem>
        <DropdownMenuItem asChild>
          <Link to={"/users" as "/"} className="flex items-center gap-2">
            <User className="w-4 h-4" /> Users &amp; roles
          </Link>
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem onSelect={() => signOut()} className="gap-2 text-destructive">
          <LogOut className="w-4 h-4" /> Sign out
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

/**
 * Runtime status rollup — reads runtime_targets in the current station scope
 * and surfaces a single broadcast-style indicator (online / degraded / offline /
 * unknown). Defensive: never invents data — falls back to "unknown" if the
 * table is empty or the query fails.
 */
function RuntimeStatusPill() {
  const { scope } = useStationScope();
  const stationId = scope.kind === "station" ? scope.station.id : null;

  const { data } = useQuery({
    queryKey: ["topbar-runtime-status", stationId ?? "all"],
    queryFn: async () => {
      let q = supabase.from("runtime_targets").select("status,is_active");
      if (stationId) q = q.eq("station_id", stationId);
      const { data, error } = await q;
      if (error) return { total: 0, online: 0, degraded: 0, offline: 0 };
      const active = (data ?? []).filter((r) => r.is_active);
      const s = (r: { status: string }) => r.status as string;
      return {
        total: active.length,
        online: active.filter((r) => s(r) === "ok").length,
        degraded: active.filter((r) => s(r) === "degraded").length,
        offline: active.filter((r) => s(r) === "down" || s(r) === "error").length,
      };
    },
    refetchInterval: 30_000,
  });

  const tone =
    !data || data.total === 0 ? "unknown" :
    data.offline > 0 ? "offline" :
    data.degraded > 0 ? "degraded" : "online";

  const label =
    tone === "online"   ? "On Air" :
    tone === "degraded" ? "Degraded" :
    tone === "offline"  ? "Offline" :
    "No targets";

  const dotCls =
    tone === "online"   ? "bg-onair onair-pulse" :
    tone === "degraded" ? "bg-warning" :
    tone === "offline"  ? "bg-destructive" :
    "bg-muted-foreground/40";

  const wrapCls =
    tone === "online"   ? "border-onair/40 text-onair" :
    tone === "degraded" ? "border-warning/40 text-warning" :
    tone === "offline"  ? "border-destructive/40 text-destructive" :
    "border-border text-muted-foreground";

  return (
    <Link
      to={"/health" as "/"}
      className={cn(
        "hidden sm:inline-flex items-center gap-2 rounded-full border bg-card/40 px-3 h-8 text-[11px] uppercase tracking-wider transition-colors hover:bg-card",
        wrapCls,
      )}
      title="Runtime health"
    >
      <span className={cn("w-2 h-2 rounded-full", dotCls)} />
      <span className="font-medium">{label}</span>
      {data && data.total > 0 && (
        <span className="text-muted-foreground/70 normal-case tracking-normal text-[10px]">
          {data.online}/{data.total}
        </span>
      )}
      <Activity className="w-3 h-3 opacity-60" />
    </Link>
  );
}

/** Compact variant used when topbar is hidden. */
export function TopbarBrand() {
  return (
    <div className="flex items-center gap-2">
      <Radio className="w-4 h-4 text-primary" />
      <span className="text-sm font-semibold tracking-wider uppercase">Radio Core</span>
    </div>
  );
}
