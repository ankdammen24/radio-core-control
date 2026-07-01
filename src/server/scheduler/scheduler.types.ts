// ─── Item types ───────────────────────────────────────────────────────────────
export type ClockItemType =
  | "music"
  | "playlist"
  | "category"
  | "jingle"
  | "commercial"
  | "news"
  | "live"
  | "silence"
  | "fallback";

export type SelectionMode = "random" | "sequential" | "weighted_random";

export type RuleType =
  | "artist_separation"
  | "title_separation"
  | "min_duration"
  | "max_duration";

// ─── Scheduler decision ───────────────────────────────────────────────────────
export interface SelectedMedia {
  id: string;
  title: string | null;
  artist: string | null;
  album: string | null;
  durationSeconds: number | null;
  filePath: string | null;
  streamUrl: string | null;
  artworkUrl: string | null;
}

export interface SchedulerDecision {
  station: {
    id: string;
    name: string;
  };
  clock: {
    id: string;
    name: string;
  } | null;
  clockItem: {
    id: string;
    minuteOffset: number;
    label: string | null;
  } | null;
  scheduledTime: string;  // ISO-8601
  itemType: ClockItemType;
  selectedMedia: SelectedMedia | null;
  reason: string;
}

// ─── Rule snapshot ────────────────────────────────────────────────────────────
export interface ActiveRules {
  artistSeparationMinutes: number;
  titleSeparationMinutes: number;
  minDurationSeconds: number | null;
  maxDurationSeconds: number | null;
}

// ─── Clock view (for GET /scheduler/clock) ────────────────────────────────────
export interface ClockView {
  clock: {
    id: string;
    name: string;
    stationId: string;
  } | null;
  currentHour: number;
  currentMinute: number;
  activeItem: {
    id: string;
    minuteOffset: number;
    itemType: ClockItemType;
    label: string | null;
  } | null;
  upcomingItems: Array<{
    id: string;
    minuteOffset: number;
    itemType: ClockItemType;
    label: string | null;
  }>;
}
