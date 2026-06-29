import {
  pgTable, text, integer, boolean, timestamp, uuid, jsonb,
} from "drizzle-orm/pg-core";

// ─── icecast_configs ──────────────────────────────────────────────────────────
export const icecastConfigs = pgTable("icecast_configs", {
  id:             uuid("id").primaryKey().defaultRandom(),
  stationId:      uuid("station_id").notNull(),
  hostname:       text("hostname").notNull().default("localhost"),
  port:           integer("port").notNull().default(8000),
  sourcePassword: text("source_password").notNull().default("hackme"),
  relayPassword:  text("relay_password").notNull().default("hackme"),
  adminUser:      text("admin_user").notNull().default("admin"),
  adminPassword:  text("admin_password").notNull().default("hackme"),
  adminEmail:     text("admin_email"),
  location:       text("location"),
  maxClients:     integer("max_clients").notNull().default(100),
  maxSources:     integer("max_sources").notNull().default(10),
  createdAt:      timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt:      timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export type IcecastConfig = typeof icecastConfigs.$inferSelect;

// ─── liquidsoap_configs ───────────────────────────────────────────────────────
export const liquidsoapConfigs = pgTable("liquidsoap_configs", {
  id:                  uuid("id").primaryKey().defaultRandom(),
  stationId:           uuid("station_id").notNull(),
  telnetHost:          text("telnet_host").notNull().default("liquidsoap"),
  telnetPort:          integer("telnet_port").notNull().default(1234),
  crossfadeSeconds:    integer("crossfade_seconds").notNull().default(3),
  normalizeAudio:      boolean("normalize_audio").notNull().default(false),
  fallbackTrackPath:   text("fallback_track_path"),
  customLiq:           text("custom_liq"),
  generatedLiq:        text("generated_liq"),
  generatedAt:         timestamp("generated_at", { withTimezone: true }),
  createdAt:           timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt:           timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export type LiquidsoapConfig = typeof liquidsoapConfigs.$inferSelect;

// ─── stream_mounts ────────────────────────────────────────────────────────────
export const streamMounts = pgTable("stream_mounts", {
  id:             uuid("id").primaryKey().defaultRandom(),
  stationId:      uuid("station_id").notNull(),
  mountPath:      text("mount_path").notNull(),
  format:         text("format").notNull().default("mp3"),
  bitrate:        integer("bitrate").notNull().default(128),
  isDefault:      boolean("is_default").notNull().default(false),
  isActive:       boolean("is_active").notNull().default(true),
  sourcePassword: text("source_password"),
  createdAt:      timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt:      timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export type StreamMount = typeof streamMounts.$inferSelect;

// ─── playlists ────────────────────────────────────────────────────────────────
export const playlists = pgTable("playlists", {
  id:                   uuid("id").primaryKey().defaultRandom(),
  stationId:            uuid("station_id").notNull(),
  name:                 text("name").notNull(),
  description:          text("description"),
  playlistType:         text("playlist_type").notNull().default("rotation"),
  priority:             integer("priority").notNull().default(1),
  isActive:             boolean("is_active").notNull().default(true),
  azuracastPlaylistId:  text("azuracast_playlist_id"),
  createdAt:            timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt:            timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export type Playlist = typeof playlists.$inferSelect;

// ─── playlist_assignments ─────────────────────────────────────────────────────
export const playlistAssignments = pgTable("playlist_assignments", {
  id:          uuid("id").primaryKey().defaultRandom(),
  playlistId:  uuid("playlist_id").notNull(),
  mediaFileId: uuid("media_file_id").notNull(),
  weight:      integer("weight").notNull().default(1),
  isActive:    boolean("is_active").notNull().default(true),
  createdAt:   timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export type PlaylistAssignment = typeof playlistAssignments.$inferSelect;

// ─── live_inputs ──────────────────────────────────────────────────────────────
export const liveInputs = pgTable("live_inputs", {
  id:              uuid("id").primaryKey().defaultRandom(),
  stationId:       uuid("station_id").notNull(),
  mountPath:       text("mount_path").notNull().default("/live"),
  harbourPort:     integer("harbor_port").notNull().default(8005),
  sourceUser:      text("source_user").notNull().default("source"),
  sourcePassword:  text("source_password").notNull().default("hackme"),
  format:          text("format").notNull().default("mp3"),
  bitrate:         integer("bitrate").notNull().default(128),
  isEnabled:       boolean("is_enabled").notNull().default(false),
  isLive:          boolean("is_live").notNull().default(false),
  autoTakeover:    boolean("auto_takeover").notNull().default(false),
  forcedTakeover:  boolean("forced_takeover").notNull().default(false),
  fadeInSeconds:   integer("fade_in_seconds").notNull().default(2),
  fadeOutSeconds:  integer("fade_out_seconds").notNull().default(2),
  notes:           text("notes"),
  lastStateChange: timestamp("last_state_change", { withTimezone: true }),
  createdAt:       timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt:       timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export type LiveInput = typeof liveInputs.$inferSelect;

// ─── fallback_tracks ──────────────────────────────────────────────────────────
export const fallbackTracks = pgTable("fallback_tracks", {
  id:          uuid("id").primaryKey().defaultRandom(),
  stationId:   uuid("station_id").notNull(),
  label:       text("label").notNull(),
  externalUrl: text("external_url"),
  mediaFileId: uuid("media_file_id"),
  priority:    integer("priority").notNull().default(10),
  isActive:    boolean("is_active").notNull().default(true),
  createdAt:   timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt:   timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export type FallbackTrack = typeof fallbackTracks.$inferSelect;

// ─── streaming_outputs ────────────────────────────────────────────────────────
export const streamingOutputs = pgTable("streaming_outputs", {
  id:                  uuid("id").primaryKey().defaultRandom(),
  stationId:           uuid("station_id").notNull(),
  name:                text("name").notNull(),
  type:                text("type").notNull().default("icecast"),
  host:                text("host").notNull().default("localhost"),
  port:                integer("port").notNull().default(8000),
  mountpoint:          text("mountpoint"),
  username:            text("username"),
  password:            text("password"),
  passwordSecretName:  text("password_secret_name"),
  format:              text("format").notNull().default("mp3"),
  bitrate:             integer("bitrate").notNull().default(128),
  codec:               text("codec").notNull().default("mp3"),
  sampleRate:          integer("sample_rate").notNull().default(44100),
  channels:            integer("channels").notNull().default(2),
  isEnabled:           boolean("is_enabled").notNull().default(true),
  isPublic:            boolean("is_public").notNull().default(true),
  useTls:              boolean("use_tls").notNull().default(false),
  priority:            integer("priority").notNull().default(0),
  proxyUrl:            text("proxy_url"),
  listenerStatsUrl:    text("listener_stats_url"),
  notes:               text("notes"),
  config:              jsonb("config").notNull().default({}),
  healthStatus:        text("health_status").notNull().default("unknown"),
  lastHealthAt:        timestamp("last_health_at", { withTimezone: true }),
  lastListeners:       integer("last_listeners"),
  createdAt:           timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt:           timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export type StreamingOutput = typeof streamingOutputs.$inferSelect;
