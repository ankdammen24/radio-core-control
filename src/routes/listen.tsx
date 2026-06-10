import { createFileRoute } from "@tanstack/react-router";
import { Card } from "@/components/ui/card";
import { PublicLayout } from "@/components/public-layout";
import { RadioPlayer } from "@/components/radio-player";
import {
  useBootstrapPlayer, usePublicNowPlaying, usePublicRecentlyPlayed,
} from "@/lib/use-public-station";
import { History, Music, Users } from "lucide-react";

export const Route = createFileRoute("/listen")({
  component: ListenPage,
  head: () => ({
    meta: [
      { title: "Listen — Live radio player" },
      { name: "description", content: "Full-page radio player with stream quality picker." },
      { property: "og:title", content: "Listen live" },
      { property: "og:description", content: "Listen to the live broadcast in your preferred stream quality." },
    ],
  }),
});

function ListenPage() {
  const { station } = useBootstrapPlayer();
  const np = usePublicNowPlaying(station?.id);
  const rp = usePublicRecentlyPlayed(station?.id);

  return (
    <PublicLayout>
      <div className="mb-6">
        <div className="text-[10px] uppercase tracking-[0.25em] text-muted-foreground">Now broadcasting</div>
        <h1 className="text-3xl font-semibold tracking-tight">{station?.name ?? "Live radio"}</h1>
      </div>

      <RadioPlayer
        title={np.data?.title}
        artist={np.data?.artist}
        fallbackArtworkUrl={station?.demo_artwork_url ?? null}
        className="mb-6"
      />

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="md:col-span-2 p-5">
          <div className="flex items-center gap-2 mb-3">
            <History className="w-4 h-4 text-muted-foreground" />
            <h2 className="text-sm font-semibold">Recently played</h2>
          </div>
          {rp.data && rp.data.length ? (
            <ul className="divide-y divide-border">
              {rp.data.map((t) => (
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
          <div className="flex items-center gap-2 mb-3">
            <Users className="w-4 h-4 text-muted-foreground" />
            <h2 className="text-sm font-semibold">Listeners</h2>
          </div>
          <div className="text-3xl font-semibold tabular-nums">{np.data?.listeners ?? "—"}</div>
          <div className="text-xs text-muted-foreground mt-1">currently tuned in</div>
        </Card>
      </div>
    </PublicLayout>
  );
}
