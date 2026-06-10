/**
 * Player context — singleton <audio> element + persistent playback state.
 *
 * Mounted once at the root so playback survives route changes. Supports
 * HLS via dynamic hls.js import (client-only) and native MP3/AAC.
 * White-label: all stream metadata comes from props/database, never
 * hardcoded.
 */
import {
  createContext, useCallback, useContext, useEffect, useRef, useState,
  type ReactNode,
} from "react";

export type StreamProfile = {
  id: string;
  label: string;
  url: string;
  format: "hls" | "aac" | "mp3";
  bitrate?: number | null;
};

export type StationPlayable = {
  id: string;
  name: string;
  slug: string;
  logoUrl?: string | null;
  accentColor?: string | null;
  streams: StreamProfile[];
};

export type PlayerState = "idle" | "loading" | "playing" | "paused" | "error";

type Ctx = {
  station: StationPlayable | null;
  current: StreamProfile | null;
  state: PlayerState;
  error: string | null;
  volume: number;
  muted: boolean;
  /** Set the station — does not auto-start playback. */
  setStation: (s: StationPlayable | null) => void;
  /** Pick a stream profile (auto-plays if already playing/loading). */
  selectStream: (profileId: string) => void;
  play: () => void;
  pause: () => void;
  toggle: () => void;
  setVolume: (v: number) => void;
  setMuted: (m: boolean) => void;
  /** Convenience: register station + start playing default stream. */
  playStation: (s: StationPlayable, preferredProfileId?: string) => void;
};

const PlayerCtx = createContext<Ctx | null>(null);

/** Pick the best default stream: prefer HLS (auto), else highest-bitrate AAC, else first. */
function pickDefault(streams: StreamProfile[]): StreamProfile | null {
  if (!streams.length) return null;
  const hls = streams.find((s) => s.format === "hls");
  if (hls) return hls;
  const aac = streams.filter((s) => s.format === "aac").sort((a, b) => (b.bitrate ?? 0) - (a.bitrate ?? 0))[0];
  return aac ?? streams[0];
}

export function PlayerProvider({ children }: { children: ReactNode }) {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const hlsRef = useRef<unknown>(null);
  const [station, setStationState] = useState<StationPlayable | null>(null);
  const [current, setCurrent] = useState<StreamProfile | null>(null);
  const [state, setState] = useState<PlayerState>("idle");
  const [error, setError] = useState<string | null>(null);
  const [volume, setVolumeState] = useState(0.8);
  const [muted, setMutedState] = useState(false);

  const teardownHls = useCallback(() => {
    const h = hlsRef.current as { destroy?: () => void } | null;
    if (h?.destroy) {
      try { h.destroy(); } catch { /* ignore */ }
    }
    hlsRef.current = null;
  }, []);

  const attachSource = useCallback(async (profile: StreamProfile) => {
    const audio = audioRef.current;
    if (!audio) return;
    teardownHls();
    setError(null);
    setState("loading");
    try {
      if (profile.format === "hls") {
        // Safari supports HLS natively
        const canNative = audio.canPlayType("application/vnd.apple.mpegurl");
        if (canNative) {
          audio.src = profile.url;
        } else {
          const { default: Hls } = await import("hls.js");
          if (Hls.isSupported()) {
            const hls = new Hls({ enableWorker: true, lowLatencyMode: true });
            hls.loadSource(profile.url);
            hls.attachMedia(audio);
            hls.on(Hls.Events.ERROR, (_evt, data) => {
              if (data.fatal) {
                setState("error");
                setError(data.details ?? "HLS error");
              }
            });
            hlsRef.current = hls;
          } else {
            audio.src = profile.url;
          }
        }
      } else {
        audio.src = profile.url;
      }
      await audio.play();
    } catch (e) {
      setState("error");
      setError(e instanceof Error ? e.message : "Playback failed");
    }
  }, [teardownHls]);

  // Audio element event wiring
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;
    const onPlay = () => setState("playing");
    const onPause = () => setState((s) => (s === "error" ? s : "paused"));
    const onWaiting = () => setState("loading");
    const onErr = () => { setState("error"); setError("Stream error"); };
    audio.addEventListener("play", onPlay);
    audio.addEventListener("playing", onPlay);
    audio.addEventListener("pause", onPause);
    audio.addEventListener("waiting", onWaiting);
    audio.addEventListener("error", onErr);
    audio.volume = volume;
    audio.muted = muted;
    return () => {
      audio.removeEventListener("play", onPlay);
      audio.removeEventListener("playing", onPlay);
      audio.removeEventListener("pause", onPause);
      audio.removeEventListener("waiting", onWaiting);
      audio.removeEventListener("error", onErr);
    };
  }, [volume, muted]);

  useEffect(() => () => teardownHls(), [teardownHls]);

  const setStation = useCallback((s: StationPlayable | null) => {
    setStationState(s);
    if (!s) { setCurrent(null); return; }
    setCurrent((prev) => prev && s.streams.some((x) => x.id === prev.id) ? prev : pickDefault(s.streams));
  }, []);

  const selectStream = useCallback((profileId: string) => {
    if (!station) return;
    const next = station.streams.find((s) => s.id === profileId);
    if (!next) return;
    setCurrent(next);
    if (state === "playing" || state === "loading") {
      void attachSource(next);
    }
  }, [station, state, attachSource]);

  const play = useCallback(() => {
    if (!current) return;
    void attachSource(current);
  }, [current, attachSource]);

  const pause = useCallback(() => {
    audioRef.current?.pause();
  }, []);

  const toggle = useCallback(() => {
    if (state === "playing" || state === "loading") pause();
    else play();
  }, [state, play, pause]);

  const setVolume = useCallback((v: number) => {
    setVolumeState(v);
    if (audioRef.current) audioRef.current.volume = v;
  }, []);

  const setMuted = useCallback((m: boolean) => {
    setMutedState(m);
    if (audioRef.current) audioRef.current.muted = m;
  }, []);

  const playStation = useCallback((s: StationPlayable, preferredProfileId?: string) => {
    setStationState(s);
    const next = (preferredProfileId && s.streams.find((p) => p.id === preferredProfileId))
      || pickDefault(s.streams);
    if (!next) return;
    setCurrent(next);
    void attachSource(next);
  }, [attachSource]);

  return (
    <PlayerCtx.Provider value={{
      station, current, state, error, volume, muted,
      setStation, selectStream, play, pause, toggle, setVolume, setMuted, playStation,
    }}>
      {children}
      {/* Singleton audio element — never unmounted */}
      <audio ref={audioRef} preload="none" crossOrigin="anonymous" />
    </PlayerCtx.Provider>
  );
}

export function usePlayer() {
  const ctx = useContext(PlayerCtx);
  if (!ctx) throw new Error("usePlayer must be used inside <PlayerProvider>");
  return ctx;
}
