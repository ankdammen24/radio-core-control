import { z } from "zod";

export const stationSchema = z.object({
  name: z.string().trim().min(2, "Name must be at least 2 characters").max(120),
  slug: z.string().trim().regex(/^[a-z0-9]([a-z0-9-]*[a-z0-9])?$/, "Lowercase letters, digits and hyphens only"),
  description: z.string().max(2000).optional().or(z.literal("")),
  account_id: z.string().uuid().optional().or(z.literal("")),
  azuracast_station_id: z.string().max(50).optional().or(z.literal("")),
});

export const accountSchema = z.object({
  name: z.string().trim().min(2).max(120),
  type: z.string().trim().max(50).optional().or(z.literal("")),
  contact_email: z.string().trim().email("Invalid email").max(255).optional().or(z.literal("")),
  notes: z.string().max(5000).optional().or(z.literal("")),
});

export const playlistSchema = z.object({
  name: z.string().trim().min(2).max(120),
  station_id: z.string().uuid("Station required"),
  playlist_type: z.string(),
  priority: z.coerce.number().int().min(0).max(100),
  azuracast_playlist_id: z.string().max(50).optional().or(z.literal("")),
  description: z.string().max(2000).optional().or(z.literal("")),
});

export const scheduleBlockSchema = z.object({
  name: z.string().trim().min(2).max(120),
  station_id: z.string().uuid("Station required"),
  day_of_week: z.string(),
  start_time: z.string().regex(/^\d{2}:\d{2}/),
  end_time: z.string().regex(/^\d{2}:\d{2}/),
  playlist_id: z.string().uuid().optional().or(z.literal("")),
  rotation_rule_id: z.string().uuid().optional().or(z.literal("")),
}).refine((v) => v.end_time > v.start_time, { message: "End time must be after start", path: ["end_time"] });

export const rotationRuleSchema = z.object({
  name: z.string().trim().min(2).max(120),
  station_id: z.string().uuid("Station required"),
  category: z.string(),
  min_minutes_between_same_artist: z.coerce.number().int().min(0).max(1440),
  min_minutes_between_same_track: z.coerce.number().int().min(0).max(10080),
  max_tracks_per_hour: z.coerce.number().int().min(1).max(60),
  priority: z.coerce.number().int().min(0).max(100),
  description: z.string().max(2000).optional().or(z.literal("")),
});

export const azuraConnectionSchema = z.object({
  station_id: z.string().uuid("Station required"),
  base_url: z.string().trim().url("Must be a valid URL").max(500),
  azuracast_station_id: z.string().trim().min(1, "Required").max(50),
  api_key_secret_name: z.string().trim().min(1).max(120),
});

export const storageLocationSchema = z.object({
  name: z.string().trim().min(2).max(120),
  type: z.string().trim().min(1).max(50),
  base_path: z.string().max(500).optional().or(z.literal("")),
  description: z.string().max(2000).optional().or(z.literal("")),
});

export function formatZodError(err: unknown): string {
  if (err instanceof Error && "issues" in err) {
    const issues = (err as any).issues as Array<{ path: (string|number)[]; message: string }>;
    return issues.map((i) => `${i.path.join(".") || "field"}: ${i.message}`).join(" · ");
  }
  return err instanceof Error ? err.message : String(err);
}
