/**
 * Scheduler Engine — decision only, no audio playback.
 *
 * Given a station + wall-clock time, answers: "what should play next?"
 *
 * Algorithm:
 *   1. Resolve the active Clock for the current hour
 *   2. Find the current Clock Item (highest minuteOffset ≤ currentMinute)
 *   3. Dispatch to the correct selection strategy based on itemType
 *   4. Apply separation / duration rules
 *   5. Return a SchedulerDecision (and optionally persist to scheduler_history)
 */
import type {
  SchedulerDecision, SelectedMedia, ActiveRules, ClockItemType, ClockView,
} from "./scheduler.types";
import {
  resolveActiveClock, getClockItems, getRules, getRecentHistory,
  getRotationMedia, getPlaylistMedia, getAnyReadyMedia, recordDecision,
  listClocks,
} from "./scheduler.repository";

// ─── Rule resolution ─────────────────────────────────────────────────────────

async function resolveRules(stationId: string): Promise<ActiveRules> {
  const rules = await getRules(stationId);
  const find = (type: string) => rules.find((r) => r.ruleType === type)?.value ?? null;
  return {
    artistSeparationMinutes: (find("artist_separation") ?? 20) as number,
    titleSeparationMinutes: (find("title_separation") ?? 60) as number,
    minDurationSeconds: find("min_duration"),
    maxDurationSeconds: find("max_duration"),
  };
}

// ─── Separation filter ───────────────────────────────────────────────────────

interface RecentEntry {
  artist: string | null;
  title: string | null;
  scheduledAt: Date;
}

function passesRules(
  media: { artist: string | null; title: string | null; durationSeconds: number | null },
  recent: RecentEntry[],
  rules: ActiveRules,
  now: Date,
): { ok: boolean; reason: string } {
  const { artistSeparationMinutes, titleSeparationMinutes, minDurationSeconds, maxDurationSeconds } = rules;

  if (minDurationSeconds !== null && (media.durationSeconds ?? 0) < minDurationSeconds) {
    return { ok: false, reason: `Track too short (${media.durationSeconds}s < ${minDurationSeconds}s)` };
  }
  if (maxDurationSeconds !== null && (media.durationSeconds ?? Infinity) > maxDurationSeconds) {
    return { ok: false, reason: `Track too long (${media.durationSeconds}s > ${maxDurationSeconds}s)` };
  }

  for (const entry of recent) {
    const ageMinutes = (now.getTime() - new Date(entry.scheduledAt).getTime()) / 60_000;

    if (media.artist && entry.artist && media.artist.toLowerCase() === entry.artist.toLowerCase()) {
      if (ageMinutes < artistSeparationMinutes) {
        return { ok: false, reason: `Artist separation violation (${entry.artist}, ${Math.round(ageMinutes)}m ago)` };
      }
    }
    if (media.title && entry.title && media.title.toLowerCase() === entry.title.toLowerCase()) {
      if (ageMinutes < titleSeparationMinutes) {
        return { ok: false, reason: `Title separation violation (${Math.round(ageMinutes)}m ago)` };
      }
    }
  }

  return { ok: true, reason: "ok" };
}

// ─── Selection strategies ────────────────────────────────────────────────────

/** Weighted random — tracks with higher weight are more likely to be chosen */
function weightedRandom<T extends { weight: number }>(items: T[]): T | null {
  if (!items.length) return null;
  const total = items.reduce((s, i) => s + i.weight, 0);
  let r = Math.random() * total;
  for (const item of items) {
    r -= item.weight;
    if (r <= 0) return item;
  }
  return items[items.length - 1];
}

function toSelectedMedia(media: {
  id: string; title: string | null; artist: string | null; album: string | null;
  durationSeconds: number | null; filePath: string | null; streamUrl: string | null;
  artworkUrl: string | null;
}): SelectedMedia {
  return {
    id: media.id,
    title: media.title,
    artist: media.artist,
    album: media.album,
    durationSeconds: media.durationSeconds ?? null,
    filePath: media.filePath,
    streamUrl: media.streamUrl,
    artworkUrl: media.artworkUrl,
  };
}

// ─── Category / music selection ───────────────────────────────────────────────

async function selectFromCategory(
  categoryId: string,
  selectionMode: string,
  recent: RecentEntry[],
  rules: ActiveRules,
  now: Date,
): Promise<{ media: SelectedMedia | null; reason: string }> {
  const pool = await getRotationMedia(categoryId);
  if (!pool.length) return { media: null, reason: "Category has no active rotation tracks" };

  // Filter by rules first
  const eligible = pool.filter((p) => passesRules(
    { artist: p.media.artist, title: p.media.title, durationSeconds: p.media.durationSeconds },
    recent, rules, now,
  ).ok);

  const candidates = eligible.length ? eligible : pool; // relax rules if nothing passes
  const relaxed = eligible.length === 0;

  let chosen: typeof pool[0] | null = null;

  if (selectionMode === "sequential") {
    chosen = candidates[0];
  } else if (selectionMode === "random") {
    chosen = candidates[Math.floor(Math.random() * candidates.length)];
  } else {
    // weighted_random (default)
    chosen = weightedRandom(candidates.map((c) => ({ ...c, weight: c.rotation.weight })));
  }

  if (!chosen) return { media: null, reason: "No track selected from category" };

  const reason = relaxed
    ? `Selected from category (rules relaxed — no eligible tracks)`
    : `Selected via ${selectionMode} from category`;

  return { media: toSelectedMedia(chosen.media), reason };
}

// ─── Playlist selection ───────────────────────────────────────────────────────

async function selectFromPlaylist(
  playlistId: string,
  selectionMode: string,
  recent: RecentEntry[],
  rules: ActiveRules,
  now: Date,
): Promise<{ media: SelectedMedia | null; reason: string }> {
  const pool = await getPlaylistMedia(playlistId);
  if (!pool.length) return { media: null, reason: "Playlist is empty" };

  const eligible = pool.filter((p) => passesRules(
    { artist: p.media.artist, title: p.media.title, durationSeconds: p.media.durationSeconds },
    recent, rules, now,
  ).ok);
  const candidates = eligible.length ? eligible : pool;

  let chosen: typeof pool[0] | null = null;

  if (selectionMode === "sequential") {
    chosen = candidates[0];
  } else if (selectionMode === "weighted_random") {
    chosen = weightedRandom(candidates.map((c) => ({ ...c, weight: c.assignment.weight })));
  } else {
    chosen = candidates[Math.floor(Math.random() * candidates.length)];
  }

  if (!chosen) return { media: null, reason: "No track selected from playlist" };
  return { media: toSelectedMedia(chosen.media), reason: `Selected via ${selectionMode} from playlist` };
}

// ─── Main engine entry point ──────────────────────────────────────────────────

export interface NextOptions {
  stationId: string;
  stationName: string;
  now?: Date;
  persist?: boolean; // write to scheduler_history
}

export async function decideNext(opts: NextOptions): Promise<SchedulerDecision> {
  const now = opts.now ?? new Date();
  const dayOfWeek = now.getDay();   // 0=Sun…6=Sat
  const hour = now.getHours();
  const minute = now.getMinutes();

  // 1. Resolve active clock
  const clock = await resolveActiveClock(opts.stationId, dayOfWeek, hour);
  const clockItems = clock ? await getClockItems(clock.id) : [];

  // 2. Current clock item = highest minuteOffset ≤ currentMinute
  const currentItem = clockItems
    .filter((i) => i.minuteOffset <= minute)
    .at(-1) ?? clockItems[0] ?? null;

  // 3. Load rules + recent history (load rules first to know the separation window)
  const rules = await resolveRules(opts.stationId);
  const separationWindow = Math.max(rules.artistSeparationMinutes, rules.titleSeparationMinutes);
  const recentHistory = await getRecentHistory(opts.stationId, separationWindow);
  const recent: RecentEntry[] = recentHistory.map((h) => ({
    artist: h.artist,
    title: h.title,
    scheduledAt: h.scheduledAt,
  }));

  const itemType: ClockItemType = (currentItem?.itemType as ClockItemType) ?? "music";

  // 4. Select media based on itemType
  let selectedMedia: SelectedMedia | null = null;
  let reason = "";

  if (itemType === "silence") {
    reason = "Clock item is silence";
  } else if (itemType === "live") {
    reason = "Clock item is live input — no media needed";
  } else if (itemType === "news") {
    reason = "Clock item is news break — external feed";
  } else if (itemType === "fallback") {
    const fallback = await getAnyReadyMedia(opts.stationId);
    selectedMedia = fallback ? toSelectedMedia(fallback) : null;
    reason = fallback ? "Fallback track selected" : "No fallback media available";
  } else if ((itemType === "category" || itemType === "music" || itemType === "jingle" || itemType === "commercial") && currentItem?.categoryId) {
    const result = await selectFromCategory(
      currentItem.categoryId,
      currentItem.selectionMode,
      recent, rules, now,
    );
    selectedMedia = result.media;
    reason = result.reason;
  } else if (itemType === "playlist" && currentItem?.playlistId) {
    const result = await selectFromPlaylist(
      currentItem.playlistId,
      currentItem.selectionMode,
      recent, rules, now,
    );
    selectedMedia = result.media;
    reason = result.reason;
  } else {
    // Generic music: pick any ready track from station
    const fallback = await getAnyReadyMedia(opts.stationId);
    selectedMedia = fallback ? toSelectedMedia(fallback) : null;
    reason = fallback
      ? "No clock/category configured — selected random ready track"
      : "No media available";
  }

  // 5. Optionally persist decision
  if (opts.persist && selectedMedia) {
    await recordDecision({
      stationId: opts.stationId,
      mediaFileId: selectedMedia.id,
      itemType,
      artist: selectedMedia.artist ?? undefined,
      title: selectedMedia.title ?? undefined,
      durationSeconds: selectedMedia.durationSeconds ?? undefined,
      clockId: clock?.id,
      clockItemId: currentItem?.id,
      reason,
    });
  }

  return {
    station: { id: opts.stationId, name: opts.stationName },
    clock: clock ? { id: clock.id, name: clock.name } : null,
    clockItem: currentItem
      ? { id: currentItem.id, minuteOffset: currentItem.minuteOffset, label: currentItem.label }
      : null,
    scheduledTime: now.toISOString(),
    itemType,
    selectedMedia,
    reason,
  };
}

// ─── Clock view ───────────────────────────────────────────────────────────────

export async function getClockView(stationId: string, at?: Date): Promise<ClockView> {
  const now = at ?? new Date();
  const dayOfWeek = now.getDay();
  const hour = now.getHours();
  const minute = now.getMinutes();

  const clock = await resolveActiveClock(stationId, dayOfWeek, hour);
  const items = clock ? await getClockItems(clock.id) : [];

  const currentItem = items.filter((i) => i.minuteOffset <= minute).at(-1) ?? null;
  const upcoming = items.filter((i) => i.minuteOffset > minute);

  return {
    clock: clock ? { id: clock.id, name: clock.name, stationId: clock.stationId } : null,
    currentHour: hour,
    currentMinute: minute,
    activeItem: currentItem
      ? {
          id: currentItem.id,
          minuteOffset: currentItem.minuteOffset,
          itemType: currentItem.itemType as ClockItemType,
          label: currentItem.label,
        }
      : null,
    upcomingItems: upcoming.map((i) => ({
      id: i.id,
      minuteOffset: i.minuteOffset,
      itemType: i.itemType as ClockItemType,
      label: i.label,
    })),
  };
}
