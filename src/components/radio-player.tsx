/**
 * Large radio player — used on the public landing / listen page.
 * Stream picker, artwork, now-playing meta, play/pause, volume, error states.
 */
import { Play, Pause, Loader2, AlertTriangle, Volume2, VolumeX, Radio } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { usePlayer } from "@/lib/player-context";
import { cn } from "@/lib/utils";

type Props = {
  artworkUrl?: string | null;
  fallbackArtworkUrl?: string | null;
  title?: string | null;
  artist?: string | null;
  className?: string;
};

export function RadioPlayer({ artworkUrl, fallbackArtworkUrl, title, artist, className }: Props) {
  const { station, current, state, error, volume, muted, toggle, selectStream, setVolume, setMuted } = usePlayer();
  const art = artworkUrl ?? fallbackArtworkUrl ?? station?.logoUrl ?? null;
  const isBusy = state === "loading";
  const isPlaying = state === "playing";

  return (
    <div className={cn(
      "relative overflow-hidden rounded-2xl border border-border bg-card/80 backdrop-blur-md p-5 sm:p-8 shadow-xl",
      className,
    )}>
      <div className="grid grid-cols-1 sm:grid-cols-[auto,1fr] gap-6 items-center">
        <div className="relative w-40 h-40 sm:w-48 sm:h-48 rounded-xl overflow-hidden bg-muted shrink-0 mx-auto sm:mx-0">
          {art ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={art} alt="" className="w-full h-full object-cover" />
          ) : (
            <div className="w-full h-full flex items-center justify-center text-muted-foreground">
              <Radio className="w-12 h-12" />
            </div>
          )}
          {isPlaying && (
            <div className="absolute bottom-2 right-2 flex gap-0.5 items-end h-6">
              <span className="w-1 bg-primary animate-pulse" style={{ height: "60%" }} />
              <span className="w-1 bg-primary animate-pulse" style={{ height: "100%", animationDelay: "120ms" }} />
              <span className="w-1 bg-primary animate-pulse" style={{ height: "40%", animationDelay: "240ms" }} />
            </div>
          )}
        </div>

        <div className="min-w-0 text-center sm:text-left">
          <div className="text-[10px] uppercase tracking-[0.25em] text-muted-foreground">
            {station?.name ?? "Live radio"}
          </div>
          <div className="mt-1 text-2xl sm:text-3xl font-semibold tracking-tight truncate">
            {title ?? "—"}
          </div>
          <div className="mt-1 text-sm text-muted-foreground truncate">
            {artist ?? "Live stream"}
          </div>

          {error && (
            <div className="mt-3 inline-flex items-center gap-2 text-xs text-destructive">
              <AlertTriangle className="w-3.5 h-3.5" /> {error}
            </div>
          )}

          <div className="mt-5 flex flex-wrap items-center gap-3 justify-center sm:justify-start">
            <Button
              size="lg"
              onClick={toggle}
              disabled={!current}
              className="rounded-full h-14 w-14 p-0 shadow-lg"
              aria-label={isPlaying ? "Pause" : "Play"}
            >
              {isBusy ? <Loader2 className="w-6 h-6 animate-spin" />
                : isPlaying ? <Pause className="w-6 h-6" />
                : <Play className="w-6 h-6 ml-0.5" />}
            </Button>

            {station && station.streams.length > 1 && (
              <Select
                value={current?.id ?? undefined}
                onValueChange={(v) => selectStream(v)}
              >
                <SelectTrigger className="w-44 h-10">
                  <SelectValue placeholder="Stream quality" />
                </SelectTrigger>
                <SelectContent>
                  {station.streams.map((s) => (
                    <SelectItem key={s.id} value={s.id}>{s.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}

            <div className="flex items-center gap-2 min-w-[150px]">
              <Button
                variant="ghost" size="icon"
                onClick={() => setMuted(!muted)}
                aria-label={muted ? "Unmute" : "Mute"}
              >
                {muted ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
              </Button>
              <Slider
                value={[Math.round(volume * 100)]}
                onValueChange={(v) => setVolume((v[0] ?? 0) / 100)}
                max={100} step={1}
                className="flex-1"
                aria-label="Volume"
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
