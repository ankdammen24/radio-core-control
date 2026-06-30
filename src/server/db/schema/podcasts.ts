import { pgTable, text, integer, timestamp, uuid } from "drizzle-orm/pg-core";

export const podcasts = pgTable("podcasts", {
  id:           uuid("id").primaryKey().defaultRandom(),
  title:        text("title").notNull(),
  description:  text("description"),
  author:       text("author"),
  imageUrl:     text("image_url"),
  rssUrl:       text("rss_url"),
  status:       text("status").notNull().default("active"),
  /** Set when this podcast was synced from a media_sources row (e.g. Fablesh); null for manually-created podcasts. */
  sourceId:     uuid("source_id"),
  externalId:   text("external_id"),
  checksum:     text("checksum"),
  createdAt:    timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt:    timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export type Podcast = typeof podcasts.$inferSelect;
export type NewPodcast = typeof podcasts.$inferInsert;

export const podcastEpisodes = pgTable("podcast_episodes", {
  id:               uuid("id").primaryKey().defaultRandom(),
  podcastId:        uuid("podcast_id").notNull(),
  title:            text("title").notNull(),
  description:      text("description"),
  audioUrl:         text("audio_url"),
  durationSeconds:  integer("duration_seconds"),
  publishedAt:      timestamp("published_at", { withTimezone: true }),
  status:           text("status").notNull().default("draft"),
  /** Remote episode id from the source (e.g. Fablesh episode id), used to diff on sync. */
  guid:             text("guid"),
  checksum:         text("checksum"),
  deletedAt:        timestamp("deleted_at", { withTimezone: true }),
  createdAt:        timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt:        timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export type PodcastEpisode = typeof podcastEpisodes.$inferSelect;
export type NewPodcastEpisode = typeof podcastEpisodes.$inferInsert;
