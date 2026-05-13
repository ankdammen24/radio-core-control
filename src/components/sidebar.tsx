/**
 * Radio Core sidebar.
 *
 * Collapsible groups organised around operator workflows:
 *   Operate · Content · Schedule · Streaming · Integrations · Admin
 *
 * Items pointing to unbuilt routes are rendered as disabled placeholders
 * with a "Soon" tag so the IA stays stable as we ship Stage 3-6.
 *
 * Top of the sidebar hosts the StationSwitcher (white-label scope).
 */
import { useState, type ReactNode } from "react";
import { Link, useRouterState } from "@tanstack/react-router";
import {
  LayoutDashboard, Radio, Music, ListMusic, Mic, Megaphone, MessageSquare,
  Calendar, Repeat, ShieldAlert, CalendarClock, Activity, Headphones, Server,
  Plug, RefreshCw, Building2, Users, HardDrive, FileCode2, Archive, ScrollText,
  Settings, ChevronDown, Webhook, Antenna, Mic2, Podcast,
  ShieldCheck, Sliders, AudioLines, MonitorSpeaker, GalleryVerticalEnd, X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { RadioCoreLogo } from "@/components/radio-core-logo";
import { cn } from "@/lib/utils";

type Item = {
  label: string;
  icon: typeof Radio;
  // Route is typed as string (loose) — we keep groups stable even when a
  // target route hasn't been built yet. Disabled items render as buttons,
  // built items as <Link>.
  to?: string;
  disabled?: boolean;
};

type Group = { id: string; label: string; items: Item[] };

const GROUPS: Group[] = [
  {
    id: "operate",
    label: "Operate",
    items: [
      { label: "Studio Cockpit", icon: GalleryVerticalEnd, to: "/cockpit" },
      { label: "Now Playing",    icon: Activity,           to: "/now-playing" },
      { label: "Live / Takeover", icon: Radio,             to: "/live" },
      { label: "Listeners",      icon: Headphones,         to: "/listeners" },
      { label: "Health",         icon: Server,             to: "/health" },
    ],
  },
  {
    id: "content",
    label: "Content",
    items: [
      { label: "Media",       icon: Music,         to: "/media" },
      { label: "Playlists",   icon: ListMusic,     to: "/playlists" },
      { label: "Voicetracks", icon: Mic,           to: "/voicetracks" },
      { label: "Ads",         icon: Megaphone,     to: "/ads" },
      { label: "Inbox",       icon: MessageSquare, to: "/inbox" },
    ],
  },
  {
    id: "schedule",
    label: "Schedule",
    items: [
      { label: "Scheduling", icon: Calendar,      to: "/scheduler" },
      { label: "Rotation",   icon: Repeat,        to: "/rotation" },
      { label: "Fallback",   icon: ShieldAlert,   to: "/fallback" },
      { label: "Shows",      icon: Mic2,          to: "/shows" },
      { label: "Episodes",   icon: CalendarClock, to: "/episodes" },
    ],
  },
  {
    id: "streaming",
    label: "Streaming",
    items: [
      { label: "Streaming Outputs", icon: AudioLines,      to: "/streaming-outputs" },
      { label: "Mountpoints",       icon: MonitorSpeaker,  disabled: true },
      { label: "Relays",            icon: Antenna,         disabled: true },
      { label: "Live Inputs",       icon: Mic,             disabled: true },
      { label: "Stream Config",     icon: FileCode2,       to: "/streaming" },
    ],
  },
  {
    id: "integrations",
    label: "Integrations",
    items: [
      { label: "Runtime Targets", icon: Plug, to: "/runtime-targets" },
      { label: "AzuraCast", icon: Plug,    to: "/azuracast" },
      { label: "Webhooks",  icon: Webhook, disabled: true },
      { label: "Sync Jobs", icon: RefreshCw, to: "/sync-jobs" },
      { label: "Podcasts",  icon: Podcast, disabled: true },
    ],
  },
  {
    id: "admin",
    label: "Admin",
    items: [
      { label: "Stations",  icon: Radio,       to: "/stations" },
      { label: "Accounts",  icon: Building2,   to: "/accounts" },
      { label: "Users",     icon: Users,       to: "/users" },
      { label: "Roles",     icon: ShieldCheck, disabled: true },
      { label: "Storage",   icon: HardDrive,   to: "/storage" },
      { label: "R2 Files",  icon: HardDrive,   to: "/r2-storage" },
      { label: "Config",    icon: Sliders,     to: "/configs" },
      { label: "Backup",    icon: Archive,     to: "/backup" },
      { label: "Audit",     icon: ScrollText,  to: "/audit" },
      { label: "Settings",  icon: Settings,    to: "/settings" },
    ],
  },
];

const LEGACY_DASHBOARD: Item = { label: "Dashboard (legacy)", icon: LayoutDashboard, to: "/" };

export function Sidebar() {
  const path = useRouterState({ select: (s) => s.location.pathname });
  const { user, signOut, roles } = useAuth();
  const { theme, toggle } = useTheme();

  // A group is open when explicitly toggled OR when it contains the active route.
  const groupHasActive = (g: Group) => g.items.some((it) => it.to && (path === it.to || (it.to !== "/" && path.startsWith(it.to))));
  const [openOverrides, setOpenOverrides] = useState<Record<string, boolean | undefined>>({});

  return (
    <aside className="w-64 shrink-0 bg-sidebar text-sidebar-foreground border-r border-sidebar-border flex flex-col h-screen sticky top-0">
      <div className="px-3 py-3 border-b border-sidebar-border space-y-3">
        <div className="flex items-center gap-2 px-1">
          <div className="w-7 h-7 rounded bg-sidebar-primary flex items-center justify-center">
            <Radio className="w-3.5 h-3.5 text-sidebar-primary-foreground" />
          </div>
          <div>
            <div className="font-semibold tracking-tight text-xs">RADIO CORE</div>
            <div className="text-[9px] uppercase tracking-widest text-sidebar-foreground/60">Control Plane</div>
          </div>
        </div>
        <StationSwitcher allowAll />
      </div>

      <nav className="flex-1 overflow-y-auto py-2 px-2 space-y-1">
        <NavLink path={path} item={LEGACY_DASHBOARD} />
        {GROUPS.map((g) => {
          const explicit = openOverrides[g.id];
          const open = explicit ?? groupHasActive(g);
          return (
            <NavGroup
              key={g.id}
              label={g.label}
              open={open}
              onToggle={() => setOpenOverrides((s) => ({ ...s, [g.id]: !open }))}
            >
              {g.items.map((it) => (
                <NavLink key={it.label} path={path} item={it} />
              ))}
            </NavGroup>
          );
        })}
      </nav>

      <div className="border-t border-sidebar-border p-3 space-y-2">
        <div className="text-xs text-sidebar-foreground/70 px-2">
          <div className="truncate font-medium text-sidebar-foreground">{user?.email}</div>
          <div className="uppercase tracking-wider text-[10px] mt-0.5">{roles.join(" · ") || "no role"}</div>
        </div>
        <div className="flex gap-2">
          <Button variant="ghost" size="sm" className="flex-1 text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground" onClick={toggle}>
            {theme === "dark" ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
          </Button>
          <Button variant="ghost" size="sm" className="flex-1 text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground" onClick={signOut}>
            <LogOut className="w-4 h-4" />
          </Button>
        </div>
      </div>
    </aside>
  );
}

function NavGroup({ label, open, onToggle, children }: {
  label: string; open: boolean; onToggle: () => void; children: ReactNode;
}) {
  return (
    <div>
      <button
        type="button"
        onClick={onToggle}
        className="w-full flex items-center justify-between px-2 py-1.5 text-[10px] uppercase tracking-widest text-sidebar-foreground/60 hover:text-sidebar-foreground transition-colors"
      >
        <span>{label}</span>
        <ChevronDown className={cn("w-3 h-3 transition-transform", open ? "rotate-0" : "-rotate-90")} />
      </button>
      {open && <div className="space-y-0.5">{children}</div>}
    </div>
  );
}

function NavLink({ path, item }: { path: string; item: Item }) {
  const Icon = item.icon;
  if (item.disabled || !item.to) {
    return (
      <div
        className="flex items-center gap-3 px-3 py-1.5 rounded-md text-sm text-sidebar-foreground/40 cursor-not-allowed select-none"
        title="Coming soon"
      >
        <Icon className="w-4 h-4 shrink-0" />
        <span className="truncate flex-1">{item.label}</span>
        <span className="text-[9px] uppercase tracking-wider rounded bg-sidebar-accent/40 px-1.5 py-0.5">Soon</span>
      </div>
    );
  }
  const active = path === item.to || (item.to !== "/" && path.startsWith(item.to));
  return (
    <Link
      to={item.to as "/"}
      className={cn(
        "flex items-center gap-3 px-3 py-1.5 rounded-md text-sm transition-colors",
        active
          ? "bg-sidebar-accent text-sidebar-accent-foreground"
          : "text-sidebar-foreground/80 hover:bg-sidebar-accent/50 hover:text-sidebar-accent-foreground",
      )}
    >
      <Icon className="w-4 h-4 shrink-0" />
      <span className="truncate">{item.label}</span>
    </Link>
  );
}
