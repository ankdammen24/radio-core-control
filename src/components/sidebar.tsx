import { Link, useRouterState } from "@tanstack/react-router";
import {
  LayoutDashboard, Users, Building2, Radio, Music, FolderOpen, Tag, ListMusic,
  Calendar, Repeat, Plug, HardDrive, RefreshCw, ScrollText, Settings, LogOut, Moon, Sun,
  Activity, Headphones, FileCode2, Server, Mic, CalendarClock, Megaphone, MessageSquare,
} from "lucide-react";
import { useAuth } from "@/lib/auth";
import { useTheme } from "@/lib/theme";
import { Button } from "@/components/ui/button";

const items = [
  { to: "/", label: "Dashboard", icon: LayoutDashboard },
  { to: "/users", label: "Users & Roles", icon: Users },
  { to: "/accounts", label: "Accounts", icon: Building2 },
  { to: "/stations", label: "Stations", icon: Radio },
  { to: "/media", label: "Media Library", icon: Music },
  { to: "/files", label: "File Manager", icon: FolderOpen },
  { to: "/metadata", label: "Track Metadata", icon: Tag },
  { to: "/playlists", label: "Playlists", icon: ListMusic },
  { to: "/scheduler", label: "Scheduler", icon: Calendar },
  { to: "/rotation", label: "Rotation Rules", icon: Repeat },
  { to: "/now-playing", label: "Now Playing", icon: Activity },
  { to: "/listeners", label: "Listener Stats", icon: Headphones },
  { to: "/streaming", label: "Streaming Config", icon: FileCode2 },
  { to: "/health", label: "Service Health", icon: Server },
  { to: "/azuracast", label: "AzuraCast", icon: Plug },
  { to: "/storage", label: "Storage Settings", icon: HardDrive },
  { to: "/sync-jobs", label: "Sync Jobs", icon: RefreshCw },
  { to: "/audit", label: "Audit Logs", icon: ScrollText },
  { to: "/settings", label: "System Settings", icon: Settings },
] as const;

export function Sidebar() {
  const path = useRouterState({ select: (s) => s.location.pathname });
  const { user, signOut, roles } = useAuth();
  const { theme, toggle } = useTheme();

  return (
    <aside className="w-64 shrink-0 bg-sidebar text-sidebar-foreground border-r border-sidebar-border flex flex-col h-screen sticky top-0">
      <div className="px-5 py-5 border-b border-sidebar-border">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded bg-sidebar-primary flex items-center justify-center">
            <Radio className="w-4 h-4 text-sidebar-primary-foreground" />
          </div>
          <div>
            <div className="font-semibold tracking-tight text-sm">RADIO CORE</div>
            <div className="text-[10px] uppercase tracking-widest text-sidebar-foreground/60">Broadcast Ops</div>
          </div>
        </div>
      </div>
      <nav className="flex-1 overflow-y-auto py-3 px-2 space-y-0.5">
        {items.map((it) => {
          const active = path === it.to || (it.to !== "/" && path.startsWith(it.to));
          return (
            <Link
              key={it.to}
              to={it.to}
              className={`flex items-center gap-3 px-3 py-2 rounded-md text-sm transition-colors ${
                active ? "bg-sidebar-accent text-sidebar-accent-foreground" : "text-sidebar-foreground/80 hover:bg-sidebar-accent/50 hover:text-sidebar-accent-foreground"
              }`}
            >
              <it.icon className="w-4 h-4 shrink-0" />
              <span className="truncate">{it.label}</span>
            </Link>
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
