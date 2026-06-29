import { pgTable, text, integer, boolean, timestamp, uuid, real } from "drizzle-orm/pg-core";

export const mediaFiles = pgTable("media_files", {
  id:                 uuid("id").primaryKey().defaultRandom(),
  stationId:          uuid("station_id"),
  fileName:           text("file_name").notNull(),
  filePath:           text("file_path"),
  originalFileName:   text("original_file_name"),
  fileType:           text("file_type"),
  mimeType:           text("mime_type"),
  fileSize:           integer("file_size"),
  durationSeconds:    real("duration_seconds"),
  checksum:           text("checksum"),
  mediaKind:          text("media_kind").notNull().default("music"),
  status:             text("status").notNull().default("ready"),
  storageLocationId:  uuid("storage_location_id"),
  azuracastMediaId:   text("azuracast_media_id"),
  createdAt:          timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt:          timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export type MediaFile = typeof mediaFiles.$inferSelect;
