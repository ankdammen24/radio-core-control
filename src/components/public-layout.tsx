/**
 * PublicLayout — top nav, footer, theme toggle, persistent mini player.
 * White-label: station name comes from PlayerProvider's active station.
 */
import { Link, useRouterState } from "@tanstack/react-router";
import { Moon, Sun, Radio } from "lucide-react";
import type { ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { useTheme } from "@/lib/theme";
import { usePlayer } from "@/lib/player-context";
import { MiniPlayer } from "@/components/mini-player";
import { cn } from "@/lib/utils";

const NAV = [
  { to: "/", label: "Home" },
  { to: "/listen", label: "Listen" },
  { to: "/schedule", label: "Schedule" },
  { to: "/programs", label: "Programs" },
  { to: "/podcasts", label: "Podcasts" },
  { to: "/about", label: "About" },
  { to: "/contact", label: "Contact" },
] as const;

export function PublicLayout({ children }: { children: ReactNode }) {
  const { theme, toggle } = useTheme();
  const { station } = usePlayer();
  const pathname = useRouterState({ select: (s) => s.location.pathname });

  return (
    <div className="min-h-screen flex flex-col bg-background text-foreground">
      <header className="border-b border-border bg-card/60 backdrop-blur-md sticky top-0 z-30">
        <div className="mx-auto max-w-6xl px-4 h-16 flex items-center gap-4">
          <Link to="/" className="flex items-center gap-2 font-semibold tracking-tight">
            {station?.logoUrl ? (
              <img src={station.logoUrl} alt="" className="w-7 h-7 rounded" />
            ) : (
              <Radio className="w-5 h-5 text-primary" />
            )}
            <span className="truncate max-w-[160px]">{station?.name ?? "Radio"}</span>
          </Link>

          <nav className="hidden md:flex items-center gap-1 ml-4">
            {NAV.map((n) => {
              const active = n.to === "/" ? pathname === "/" : pathname.startsWith(n.to);
              return (
                <Link
                  key={n.to}
                  to={n.to as "/"}
                  className={cn(
                    "px-3 py-1.5 rounded-md text-sm transition-colors",
                    active ? "bg-muted text-foreground" : "text-muted-foreground hover:text-foreground hover:bg-muted/50",
                  )}
                >
                  {n.label}
                </Link>
              );
            })}
          </nav>

          <div className="ml-auto flex items-center gap-2">
            <Button variant="ghost" size="icon" onClick={toggle} aria-label="Toggle theme">
              {theme === "dark" ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
            </Button>
            <Button asChild variant="outline" size="sm">
              <Link to={"/admin" as "/"}>Admin</Link>
            </Button>
          </div>
        </div>

        {/* Mobile nav */}
        <div className="md:hidden border-t border-border overflow-x-auto">
          <div className="flex gap-1 px-3 py-2">
            {NAV.map((n) => {
              const active = n.to === "/" ? pathname === "/" : pathname.startsWith(n.to);
              return (
                <Link
                  key={n.to}
                  to={n.to as "/"}
                  className={cn(
                    "px-3 py-1 rounded-md text-xs whitespace-nowrap",
                    active ? "bg-muted text-foreground" : "text-muted-foreground",
                  )}
                >
                  {n.label}
                </Link>
              );
            })}
          </div>
        </div>
      </header>

      <main className="flex-1 mx-auto w-full max-w-6xl px-4 py-8 pb-24">{children}</main>

      <footer className="border-t border-border py-6 text-xs text-muted-foreground">
        <div className="mx-auto max-w-6xl px-4 flex flex-wrap items-center justify-between gap-2">
          <div>&copy; {new Date().getFullYear()} {station?.name ?? "Radio"}</div>
          <div className="flex gap-3">
            <Link to={"/about" as "/"}>About</Link>
            <Link to={"/contact" as "/"}>Contact</Link>
          </div>
        </div>
      </footer>

      <MiniPlayer />
    </div>
  );
}
