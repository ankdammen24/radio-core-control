
-- Enums
DO $$ BEGIN
  CREATE TYPE public.podcast_source_kind AS ENUM ('fablesh','rss');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.schedule_block_kind AS ENUM ('music','jingle','ad','live','news','podcast');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.podcast_play_source AS ENUM ('schedule','manual','live');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.podcast_sync_status AS ENUM ('running','success','partial','error');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- 1) podcast_sources
CREATE TABLE public.podcast_sources (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  kind public.podcast_source_kind NOT NULL DEFAULT 'fablesh',
  base_url text NOT NULL,
  auth_secret_name text,
  sync_interval_minutes int NOT NULL DEFAULT 15 CHECK (sync_interval_minutes BETWEEN 1 AND 1440),
  last_synced_at timestamptz,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.podcast_sources TO authenticated;
GRANT ALL ON public.podcast_sources TO service_role;
ALTER TABLE public.podcast_sources ENABLE ROW LEVEL SECURITY;
CREATE POLICY "podcast_sources admin/editor all" ON public.podcast_sources
  FOR ALL TO authenticated
  USING (public.is_admin_or_editor(auth.uid()))
  WITH CHECK (public.is_admin_or_editor(auth.uid()));
CREATE TRIGGER trg_podcast_sources_updated_at BEFORE UPDATE ON public.podcast_sources
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- 2) podcasts
CREATE TABLE public.podcasts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  source_id uuid NOT NULL REFERENCES public.podcast_sources(id) ON DELETE CASCADE,
  external_id text NOT NULL,
  title text NOT NULL,
  description text,
  language text,
  categories text[] NOT NULL DEFAULT '{}',
  artwork_url text,
  owner text,
  last_updated_at timestamptz,
  checksum text,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (source_id, external_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.podcasts TO authenticated;
GRANT ALL ON public.podcasts TO service_role;
ALTER TABLE public.podcasts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "podcasts admin/editor all" ON public.podcasts
  FOR ALL TO authenticated
  USING (public.is_admin_or_editor(auth.uid()))
  WITH CHECK (public.is_admin_or_editor(auth.uid()));
CREATE TRIGGER trg_podcasts_updated_at BEFORE UPDATE ON public.podcasts
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE INDEX idx_podcasts_source ON public.podcasts(source_id);
CREATE INDEX idx_podcasts_active ON public.podcasts(is_active);

-- 3) podcast_episodes
CREATE TABLE public.podcast_episodes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  podcast_id uuid NOT NULL REFERENCES public.podcasts(id) ON DELETE CASCADE,
  guid text NOT NULL,
  title text NOT NULL,
  description text,
  publish_date timestamptz,
  duration_seconds int,
  explicit boolean NOT NULL DEFAULT false,
  season int,
  episode_number int,
  audio_url text NOT NULL,
  audio_format text,
  artwork_url text,
  transcript_url text,
  checksum text,
  version int NOT NULL DEFAULT 1,
  deleted_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (podcast_id, guid)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.podcast_episodes TO authenticated;
GRANT ALL ON public.podcast_episodes TO service_role;
ALTER TABLE public.podcast_episodes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "podcast_episodes admin/editor all" ON public.podcast_episodes
  FOR ALL TO authenticated
  USING (public.is_admin_or_editor(auth.uid()))
  WITH CHECK (public.is_admin_or_editor(auth.uid()));
CREATE TRIGGER trg_podcast_episodes_updated_at BEFORE UPDATE ON public.podcast_episodes
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE INDEX idx_podcast_episodes_podcast ON public.podcast_episodes(podcast_id, publish_date DESC);
CREATE INDEX idx_podcast_episodes_alive ON public.podcast_episodes(podcast_id) WHERE deleted_at IS NULL;

-- 4) station_podcast_subscriptions
CREATE TABLE public.station_podcast_subscriptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  station_id uuid NOT NULL REFERENCES public.stations(id) ON DELETE CASCADE,
  podcast_id uuid NOT NULL REFERENCES public.podcasts(id) ON DELETE CASCADE,
  priority int NOT NULL DEFAULT 50 CHECK (priority BETWEEN 0 AND 100),
  auto_import boolean NOT NULL DEFAULT true,
  manual_review boolean NOT NULL DEFAULT false,
  max_episodes int,
  allow_explicit boolean NOT NULL DEFAULT true,
  only_swedish boolean NOT NULL DEFAULT false,
  only_owned boolean NOT NULL DEFAULT false,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (station_id, podcast_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.station_podcast_subscriptions TO authenticated;
GRANT ALL ON public.station_podcast_subscriptions TO service_role;
ALTER TABLE public.station_podcast_subscriptions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "station_podcast_subs admin/editor all" ON public.station_podcast_subscriptions
  FOR ALL TO authenticated
  USING (public.is_admin_or_editor(auth.uid()))
  WITH CHECK (public.is_admin_or_editor(auth.uid()));
CREATE TRIGGER trg_station_podcast_subs_updated_at BEFORE UPDATE ON public.station_podcast_subscriptions
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE INDEX idx_station_podcast_subs_station ON public.station_podcast_subscriptions(station_id);

-- 5) podcast_play_log
CREATE TABLE public.podcast_play_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  station_id uuid NOT NULL REFERENCES public.stations(id) ON DELETE CASCADE,
  episode_id uuid NOT NULL REFERENCES public.podcast_episodes(id) ON DELETE CASCADE,
  played_at timestamptz NOT NULL DEFAULT now(),
  duration_played int,
  source public.podcast_play_source NOT NULL DEFAULT 'schedule'
);
GRANT SELECT ON public.podcast_play_log TO authenticated;
GRANT ALL ON public.podcast_play_log TO service_role;
ALTER TABLE public.podcast_play_log ENABLE ROW LEVEL SECURITY;
CREATE POLICY "podcast_play_log read admin/editor" ON public.podcast_play_log
  FOR SELECT TO authenticated
  USING (public.is_admin_or_editor(auth.uid()));
CREATE INDEX idx_podcast_play_log_station_time ON public.podcast_play_log(station_id, played_at DESC);
CREATE INDEX idx_podcast_play_log_episode ON public.podcast_play_log(episode_id, played_at DESC);

-- 6) podcast_sync_runs
CREATE TABLE public.podcast_sync_runs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  source_id uuid NOT NULL REFERENCES public.podcast_sources(id) ON DELETE CASCADE,
  started_at timestamptz NOT NULL DEFAULT now(),
  finished_at timestamptz,
  podcasts_seen int NOT NULL DEFAULT 0,
  episodes_new int NOT NULL DEFAULT 0,
  episodes_updated int NOT NULL DEFAULT 0,
  episodes_deleted int NOT NULL DEFAULT 0,
  status public.podcast_sync_status NOT NULL DEFAULT 'running',
  error text
);
GRANT SELECT ON public.podcast_sync_runs TO authenticated;
GRANT ALL ON public.podcast_sync_runs TO service_role;
ALTER TABLE public.podcast_sync_runs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "podcast_sync_runs read admin/editor" ON public.podcast_sync_runs
  FOR SELECT TO authenticated
  USING (public.is_admin_or_editor(auth.uid()));
CREATE INDEX idx_podcast_sync_runs_source ON public.podcast_sync_runs(source_id, started_at DESC);

-- 7) Extend schedule_blocks with kind + selector
ALTER TABLE public.schedule_blocks
  ADD COLUMN IF NOT EXISTS block_kind public.schedule_block_kind NOT NULL DEFAULT 'music',
  ADD COLUMN IF NOT EXISTS podcast_selector jsonb;

-- 8) Station API key for distribution API (Bearer-token auth)
ALTER TABLE public.stations
  ADD COLUMN IF NOT EXISTS api_key_hash text,
  ADD COLUMN IF NOT EXISTS api_key_prefix text;
CREATE INDEX IF NOT EXISTS idx_stations_api_key_prefix ON public.stations(api_key_prefix);
