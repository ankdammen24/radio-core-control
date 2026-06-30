import { pgTable, text, integer, boolean, timestamp, uuid } from "drizzle-orm/pg-core";

export const playlists = pgTable("playlists", {
  id:                   uuid("id").primaryKey().defaultRandom(),
  name:                 text("name").notNull(),
  description:          text("description"),
  stationId:            uuid("station_id"),
  playlistType:         text("playlist_type").notNull().default("rotation"),
  priority:             integer("priority").notNull().default(5),
  azuracastPlaylistId:  text("azuracast_playlist_id"),
  isActive:             boolean("is_active").notNull().default(true),
  createdAt:            timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt:            timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export type Playlist = typeof playlists.$inferSelect;
export type NewPlaylist = typeof playlists.$inferInsert;

export const playlistAssignments = pgTable("playlist_assignments", {
  id:         uuid("id").primaryKey().defaultRandom(),
  playlistId: uuid("playlist_id").notNull(),
  mediaId:    uuid("media_id").notNull(),
  position:   integer("position").notNull().default(0),
  createdAt:  timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export type PlaylistAssignment = typeof playlistAssignments.$inferSelect;
export type NewPlaylistAssignment = typeof playlistAssignments.$inferInsert;
