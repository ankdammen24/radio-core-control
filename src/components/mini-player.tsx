/**
 * Mini player — fixed to bottom of viewport once playback has started.
 * Persists across route changes via the singleton audio in <PlayerProvider>.
 */
import { Play, Pause, Loader2, Radio } from "lucide-react";
import { Button } from "@/components/ui/button";
import { usePlayer } from "@/lib/player-context";

type Props = { title?: string | null; artist?: string | null; artworkUrl?: string | null };

export function MiniPlayer({ title, artist, artworkUrl }: Props) {
  const { station, current, state, toggle } = usePlayer();
  // Only show once user has engaged with the player (current stream selected and not pristine idle).
  if (!current || state === "idle") return null;

  const isBusy = state === "loading";
  const isPlaying = state === "playing";
  const art = artworkUrl ?? station?.logoUrl ?? null;

  return (
    <div className="fixed bottom-0 left-0 right-0 z-40 border-t border-border bg-card/90 backdrop-blur-xl">
      <div className="mx-auto max-w-6xl px-3 sm:px-4 h-16 flex items-center gap-3">
        <div className="w-10 h-10 rounded-md overflow-hidden bg-muted shrink-0">
          {art ? (
            <img src={art} alt="" className="w-full h-full object-cover" />
          ) : (
            <div className="w-full h-full flex items-center justify-center text-muted-foreground">
              <Radio className="w-4 h-4" />
            </div>
          )}
        </div>
        <div className="min-w-0 flex-1">
          <div className="text-sm font-medium truncate">{title ?? station?.name ?? "Live"}</div>
          <div className="text-xs text-muted-foreground truncate">{artist ?? current.label}</div>
        </div>
        <Button
          size="icon"
          onClick={toggle}
          className="rounded-full h-10 w-10"
          aria-label={isPlaying ? "Pause" : "Play"}
        >
          {isBusy ? <Loader2 className="w-4 h-4 animate-spin" />
            : isPlaying ? <Pause className="w-4 h-4" />
            : <Play className="w-4 h-4 ml-0.5" />}
        </Button>
      </div>
    </div>
  );
}
