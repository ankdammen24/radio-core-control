/**
 * Public landing page — hero + large player + now playing + recently played
 * + schedule preview. White-label: all branding comes from the active station
 * resolved via useBootstrapPlayer.
 */
import { createFileRoute, Link } from "@tanstack/react-router";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { PublicLayout } from "@/components/public-layout";
import { RadioPlayer } from "@/components/radio-player";
import {
  useBootstrapPlayer, usePublicNowPlaying, usePublicRecentlyPlayed, usePublicSchedule,
} from "@/lib/use-public-station";
import { Calendar, History, Music, Mic, Newspaper, Sparkles } from "lucide-react";

export const Route = createFileRoute("/")({
  component: PublicHome,
  head: () => ({
    meta: [
      { title: "Listen live — Internet radio, podcasts and programs" },
      { name: "description", content: "Tune in to live radio, browse programs, podcasts and the schedule." },
      { property: "og:title", content: "Listen live" },
      { property: "og:description", content: "Live radio, programs, and podcasts in one place." },
    ],
  }),
});

function PublicHome() {
  const { station, loading } = useBootstrapPlayer();
  const np = usePublicNowPlaying(station?.id);
  const rp = usePublicRecentlyPlayed(station?.id);
  const sched = usePublicSchedule(station?.id);

  return (
    <PublicLayout>
      {/* Hero */}
      <section className="relative mb-8">
        <div className="absolute inset-0 -z-10 bg-gradient-to-br from-primary/20 via-transparent to-transparent blur-3xl rounded-3xl" />
        <div className="text-center sm:text-left max-w-3xl mb-8">
          <div className="inline-flex items-center gap-2 text-[10px] uppercase tracking-[0.25em] text-muted-foreground mb-3">
            <span className="w-2 h-2 rounded-full bg-onair animate-pulse" /> Live now
          </div>
          <h1 className="text-3xl sm:text-5xl font-semibold tracking-tight">
            {loading ? "Loading…" : station?.name ?? "Radio"}
          </h1>
          {station?.description && (
            <p className="mt-3 text-muted-foreground max-w-2xl">{station.description}</p>
          )}
        </div>

        <RadioPlayer
          title={np.data?.title}
          artist={np.data?.artist}
          fallbackArtworkUrl={station?.demo_artwork_url ?? null}
        />
      </section>

      {/* Two-column: recently played + schedule preview */}
      <section className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-8">
        <Card className="p-5">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <History className="w-4 h-4 text-muted-foreground" />
              <h2 className="text-sm font-semibold tracking-tight">Recently played</h2>
            </div>
            <Link to={"/listen" as "/"} className="text-xs text-primary hover:underline">Open player</Link>
          </div>
          {rp.isLoading ? (
            <div className="text-xs text-muted-foreground">Loading…</div>
          ) : rp.data && rp.data.length ? (
            <ul className="divide-y divide-border">
              {rp.data.slice(0, 8).map((t) => (
                <li key={t.id} className="py-2 flex items-center gap-3">
                  <Music className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
                  <div className="min-w-0 flex-1">
                    <div className="text-sm truncate">{t.title ?? "Unknown"}</div>
                    <div className="text-xs text-muted-foreground truncate">{t.artist ?? "—"}</div>
                  </div>
                  <div className="text-[10px] text-muted-foreground tabular-nums">
                    {t.played_at ? new Date(t.played_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) : ""}
                  </div>
                </li>
              ))}
            </ul>
          ) : (
            <div className="text-xs text-muted-foreground">No history yet.</div>
          )}
        </Card>

        <Card className="p-5">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <Calendar className="w-4 h-4 text-muted-foreground" />
              <h2 className="text-sm font-semibold tracking-tight">Upcoming on the schedule</h2>
            </div>
            <Link to={"/schedule" as "/"} className="text-xs text-primary hover:underline">Full schedule</Link>
          </div>
          {sched.isLoading ? (
            <div className="text-xs text-muted-foreground">Loading…</div>
          ) : sched.data && sched.data.length ? (
            <ul className="divide-y divide-border">
              {sched.data.slice(0, 6).map((b) => (
                <li key={b.id} className="py-2 flex items-center gap-3">
                  <div className="text-[10px] uppercase tracking-wider text-muted-foreground w-20 shrink-0">
                    {b.day_of_week}
                  </div>
                  <div className="min-w-0 flex-1 text-sm truncate">{b.name}</div>
                  <div className="text-xs text-muted-foreground tabular-nums">
                    {b.start_time.slice(0, 5)} – {b.end_time.slice(0, 5)}
                  </div>
                </li>
              ))}
            </ul>
          ) : (
            <div className="text-xs text-muted-foreground">No scheduled blocks yet.</div>
          )}
        </Card>
      </section>

      {/* Placeholder sections for future modules */}
      <section className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-12">
        <PlaceholderCard icon={Newspaper} title="News" body="A live news feed will appear here when the news module is connected." />
        <PlaceholderCard icon={Mic} title="Podcasts" body="Browse on-demand episodes once the podcast catalog is published." link="/podcasts" linkLabel="Podcasts" />
        <PlaceholderCard icon={Sparkles} title="Catalogus Musicus" body="External music catalog import — placeholder for the upcoming integration." />
      </section>

      <div className="text-center">
        <Button asChild size="lg">
          <Link to={"/listen" as "/"}>Open the full player</Link>
        </Button>
      </div>
    </PublicLayout>
  );
}

function PlaceholderCard({ icon: Icon, title, body, link, linkLabel }: {
  icon: typeof Newspaper; title: string; body: string; link?: string; linkLabel?: string;
}) {
  return (
    <Card className="p-5 border-dashed">
      <div className="flex items-center gap-2 mb-2">
        <Icon className="w-4 h-4 text-muted-foreground" />
        <h3 className="text-sm font-semibold">{title}</h3>
      </div>
      <p className="text-xs text-muted-foreground">{body}</p>
      {link && (
        <Link to={link as "/"} className="mt-3 inline-block text-xs text-primary hover:underline">
          {linkLabel} →
        </Link>
      )}
    </Card>
  );
}
