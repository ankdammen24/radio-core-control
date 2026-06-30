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
  Settings, ChevronDown, Webhook, Antenna, Mic2, Podcast, Cloud,
  ShieldCheck, Sliders, AudioLines, MonitorSpeaker, GalleryVerticalEnd, X,
  Cpu, Newspaper, Key, GitCompareArrows,
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
      { label: "News",        icon: Newspaper,     to: "/news" },
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
      // AzuraCast hidden — legacy integration, phasing out per radio-core-v2.md §3
      { label: "Agents",    icon: Cpu,     to: "/agents" },
      { label: "Webhooks",  icon: Webhook, disabled: true },
      { label: "Sync Jobs", icon: RefreshCw, to: "/sync-jobs" },
      { label: "Podcast Hub", icon: Podcast, to: "/podcast-hub" },
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
      { label: "API Tokens", icon: Key,        to: "/tokens" },
      { label: "Storage",   icon: HardDrive,   to: "/storage" },
      { label: "R2 Files",  icon: HardDrive,   to: "/r2-storage" },
      { label: "Storage Targets", icon: Cloud, to: "/storage-targets" },
      { label: "Config",    icon: Sliders,     to: "/configs" },
      { label: "Backup",    icon: Archive,     to: "/backup" },
      { label: "Audit",     icon: ScrollText,  to: "/audit" },
      { label: "Settings",  icon: Settings,    to: "/settings" },
      { label: "Migration Status", icon: GitCompareArrows, to: "/migration-status" },
    ],
  },
];

const LEGACY_DASHBOARD: Item = { label: "Dashboard", icon: LayoutDashboard, to: "/" };

export function Sidebar({ onNavigate, showClose }: { onNavigate?: () => void; showClose?: boolean }) {
  const path = useRouterState({ select: (s) => s.location.pathname });

  const groupHasActive = (g: Group) => g.items.some((it) => it.to && (path === it.to || (it.to !== "/" && path.startsWith(it.to))));
  const [openOverrides, setOpenOverrides] = useState<Record<string, boolean | undefined>>({});

  return (
    <aside className="w-64 shrink-0 bg-sidebar text-sidebar-foreground border-r border-sidebar-border flex flex-col h-full">
      <div className="px-4 py-4 border-b border-sidebar-border flex items-center justify-between">
        <Link to={"/" as "/"} onClick={onNavigate} className="block text-sidebar-foreground hover:opacity-90 transition">
          <RadioCoreLogo size="md" tone="brand" />
        </Link>
        {showClose && (
          <Button
            variant="ghost"
            size="icon"
            onClick={onNavigate}
            className="lg:hidden text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
            aria-label="Close navigation"
          >
            <X className="w-4 h-4" />
          </Button>
        )}
      </div>

      <nav className="flex-1 overflow-y-auto py-3 px-2 space-y-1">
        <NavLink path={path} item={LEGACY_DASHBOARD} onNavigate={onNavigate} />
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
                <NavLink key={it.label} path={path} item={it} onNavigate={onNavigate} />
              ))}
            </NavGroup>
          );
        })}
      </nav>

      <div className="border-t border-sidebar-border px-4 py-3 text-[10px] uppercase tracking-widest text-sidebar-foreground/50">
        <div className="flex items-center gap-2">
          <span className="w-1.5 h-1.5 rounded-full bg-success" />
          <span>System ready</span>
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

function NavLink({ path, item, onNavigate }: { path: string; item: Item; onNavigate?: () => void }) {
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
      onClick={onNavigate}
      className={cn(
        "flex items-center gap-3 px-3 py-1.5 rounded-md text-sm transition-colors relative",
        active
          ? "bg-sidebar-accent text-sidebar-accent-foreground before:content-[''] before:absolute before:left-0 before:top-1.5 before:bottom-1.5 before:w-0.5 before:rounded-r before:bg-sidebar-primary"
          : "text-sidebar-foreground/80 hover:bg-sidebar-accent/50 hover:text-sidebar-accent-foreground",
      )}
    >
      <Icon className={cn("w-4 h-4 shrink-0", active && "text-sidebar-primary")} />
      <span className="truncate">{item.label}</span>
    </Link>
  );
}
