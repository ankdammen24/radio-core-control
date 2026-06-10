/**
 * useStationBootstrap — loads the active public station + stream profiles and
 * registers them with the PlayerProvider so the player has something to play.
 */
import { useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import {
  getPublicStation, getPublicStreams, getPublicNowPlaying, getPublicRecentlyPlayed, getPublicSchedule,
} from "@/lib/public-station.functions";
import { usePlayer } from "@/lib/player-context";

export function useActivePublicStation(slug?: string) {
  const fetchStation = useServerFn(getPublicStation);
  return useQuery({
    queryKey: ["public-station", slug ?? "default"],
    queryFn: () => fetchStation({ data: { slug } }),
  });
}

export function usePublicStreams(stationId: string | undefined) {
  const fetchStreams = useServerFn(getPublicStreams);
  return useQuery({
    queryKey: ["public-streams", stationId],
    queryFn: () => fetchStreams({ data: { stationId: stationId! } }),
    enabled: !!stationId,
  });
}

export function usePublicNowPlaying(stationId: string | undefined) {
  const fetchNp = useServerFn(getPublicNowPlaying);
  return useQuery({
    queryKey: ["public-np", stationId],
    queryFn: () => fetchNp({ data: { stationId: stationId! } }),
    enabled: !!stationId,
    refetchInterval: 20_000,
  });
}

export function usePublicRecentlyPlayed(stationId: string | undefined) {
  const fetchRp = useServerFn(getPublicRecentlyPlayed);
  return useQuery({
    queryKey: ["public-rp", stationId],
    queryFn: () => fetchRp({ data: { stationId: stationId! } }),
    enabled: !!stationId,
    refetchInterval: 60_000,
  });
}

export function usePublicSchedule(stationId: string | undefined) {
  const fetchSched = useServerFn(getPublicSchedule);
  return useQuery({
    queryKey: ["public-schedule", stationId],
    queryFn: () => fetchSched({ data: { stationId: stationId! } }),
    enabled: !!stationId,
  });
}

/** Loads station + streams and registers them with the player (idempotent). */
export function useBootstrapPlayer(slug?: string) {
  const { setStation, station: current } = usePlayer();
  const stationQ = useActivePublicStation(slug);
  const streamsQ = usePublicStreams(stationQ.data?.id);

  useEffect(() => {
    if (!stationQ.data || !streamsQ.data) return;
    const playable = {
      id: stationQ.data.id,
      name: stationQ.data.name,
      slug: stationQ.data.slug,
      logoUrl: stationQ.data.logo_url,
      accentColor: stationQ.data.accent_color,
      streams: streamsQ.data.map((s) => ({
        id: s.id, label: s.label, url: s.url, format: s.format, bitrate: s.bitrate,
      })),
    };
    if (current?.id !== playable.id || current.streams.length !== playable.streams.length) {
      setStation(playable);
    }
  }, [stationQ.data, streamsQ.data, current, setStation]);

  return { station: stationQ.data, streams: streamsQ.data, loading: stationQ.isLoading || streamsQ.isLoading };
}
