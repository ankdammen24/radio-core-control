// Single source of truth for media_kind values.
// Shared across server worker, server functions, and any future UI code.
// Keep this list in sync with the DB CHECK / app contract.

export const MEDIA_KINDS = ["music", "jingle", "sweeper", "promo", "fx"] as const;

export type MediaKind = (typeof MEDIA_KINDS)[number];

const MEDIA_KIND_SET: ReadonlySet<MediaKind> = new Set(MEDIA_KINDS);

export function isMediaKind(value: unknown): value is MediaKind {
  return typeof value === "string" && MEDIA_KIND_SET.has(value as MediaKind);
}

/**
 * Parse an unknown value into a MediaKind. Falls back to "music" for
 * missing/invalid input so callers always get a valid enum value.
 */
export function parseMediaKind(value: unknown, fallback: MediaKind = "music"): MediaKind {
  return isMediaKind(value) ? value : fallback;
}

/**
 * Parse a value strictly — throws on invalid input. Use when the caller
 * must reject unknown values (e.g. validating job payloads).
 */
export function parseMediaKindStrict(value: unknown): MediaKind {
  if (isMediaKind(value)) return value;
  throw new Error(
    `Invalid media_kind: ${JSON.stringify(value)}. Expected one of ${MEDIA_KINDS.join(", ")}.`,
  );
}
