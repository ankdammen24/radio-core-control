
-- Streaming-related schema for Radio Core MVP

-- Stream mountpoints (Icecast mounts per station)
CREATE TABLE public.stream_mounts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  station_id uuid NOT NULL,
  mount_path text NOT NULL,
  format text NOT NULL DEFAULT 'mp3',
  bitrate integer NOT NULL DEFAULT 128,
  is_default boolean NOT NULL DEFAULT true,
  source_password text,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.stream_mounts ENABLE ROW LEVEL SECURITY;
CREATE POLICY stream_mounts_select_auth ON public.stream_mounts FOR SELECT TO authenticated USING (true);
CREATE POLICY stream_mounts_insert_editor ON public.stream_mounts FOR INSERT TO authenticated WITH CHECK (public.is_admin_or_editor(auth.uid()));
CREATE POLICY stream_mounts_update_editor ON public.stream_mounts FOR UPDATE TO authenticated USING (public.is_admin_or_editor(auth.uid())) WITH CHECK (public.is_admin_or_editor(auth.uid()));
CREATE POLICY stream_mounts_delete_admin ON public.stream_mounts FOR DELETE TO authenticated USING (public.has_role(auth.uid(),'admin'));
CREATE TRIGGER stream_mounts_updated BEFORE UPDATE ON public.stream_mounts FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Icecast server config (single row per station typically)
CREATE TABLE public.icecast_configs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  station_id uuid NOT NULL UNIQUE,
  hostname text NOT NULL DEFAULT 'localhost',
  port integer NOT NULL DEFAULT 8000,
  admin_user text NOT NULL DEFAULT 'admin',
  admin_password text NOT NULL DEFAULT 'changeme',
  source_password text NOT NULL DEFAULT 'changeme',
  relay_password text NOT NULL DEFAULT 'changeme',
  max_clients integer NOT NULL DEFAULT 1000,
  max_sources integer NOT NULL DEFAULT 10,
  location text DEFAULT 'Sweden',
  admin_email text DEFAULT 'admin@example.com',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.icecast_configs ENABLE ROW LEVEL SECURITY;
CREATE POLICY icecast_configs_select_auth ON public.icecast_configs FOR SELECT TO authenticated USING (true);
CREATE POLICY icecast_configs_insert_admin ON public.icecast_configs FOR INSERT TO authenticated WITH CHECK (public.has_role(auth.uid(),'admin'));
CREATE POLICY icecast_configs_update_admin ON public.icecast_configs FOR UPDATE TO authenticated USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));
CREATE POLICY icecast_configs_delete_admin ON public.icecast_configs FOR DELETE TO authenticated USING (public.has_role(auth.uid(),'admin'));
CREATE TRIGGER icecast_configs_updated BEFORE UPDATE ON public.icecast_configs FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Liquidsoap config (per station)
CREATE TABLE public.liquidsoap_configs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  station_id uuid NOT NULL UNIQUE,
  crossfade_seconds numeric NOT NULL DEFAULT 2.0,
  normalize_audio boolean NOT NULL DEFAULT true,
  fallback_track_path text,
  custom_liq text,
  telnet_host text NOT NULL DEFAULT 'localhost',
  telnet_port integer NOT NULL DEFAULT 1234,
  generated_at timestamptz,
  generated_liq text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.liquidsoap_configs ENABLE ROW LEVEL SECURITY;
CREATE POLICY liquidsoap_configs_select_auth ON public.liquidsoap_configs FOR SELECT TO authenticated USING (true);
CREATE POLICY liquidsoap_configs_insert_admin ON public.liquidsoap_configs FOR INSERT TO authenticated WITH CHECK (public.has_role(auth.uid(),'admin'));
CREATE POLICY liquidsoap_configs_update_admin ON public.liquidsoap_configs FOR UPDATE TO authenticated USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));
CREATE POLICY liquidsoap_configs_delete_admin ON public.liquidsoap_configs FOR DELETE TO authenticated USING (public.has_role(auth.uid(),'admin'));
CREATE TRIGGER liquidsoap_configs_updated BEFORE UPDATE ON public.liquidsoap_configs FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Now playing (current track + listeners snapshot, one row per station)
CREATE TABLE public.now_playing (
  station_id uuid PRIMARY KEY,
  media_file_id uuid,
  title text,
  artist text,
  album text,
  started_at timestamptz NOT NULL DEFAULT now(),
  duration_seconds numeric,
  listeners integer NOT NULL DEFAULT 0,
  mount_path text,
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.now_playing ENABLE ROW LEVEL SECURITY;
CREATE POLICY now_playing_select_all ON public.now_playing FOR SELECT TO authenticated, anon USING (true);
CREATE POLICY now_playing_insert_editor ON public.now_playing FOR INSERT TO authenticated WITH CHECK (public.is_admin_or_editor(auth.uid()));
CREATE POLICY now_playing_update_editor ON public.now_playing FOR UPDATE TO authenticated USING (public.is_admin_or_editor(auth.uid())) WITH CHECK (public.is_admin_or_editor(auth.uid()));
CREATE TRIGGER now_playing_updated BEFORE UPDATE ON public.now_playing FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Play history
CREATE TABLE public.play_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  station_id uuid NOT NULL,
  media_file_id uuid,
  title text,
  artist text,
  album text,
  played_at timestamptz NOT NULL DEFAULT now(),
  duration_seconds numeric,
  listeners integer
);
CREATE INDEX play_history_station_idx ON public.play_history(station_id, played_at DESC);
ALTER TABLE public.play_history ENABLE ROW LEVEL SECURITY;
CREATE POLICY play_history_select_auth ON public.play_history FOR SELECT TO authenticated USING (true);
CREATE POLICY play_history_insert_editor ON public.play_history FOR INSERT TO authenticated WITH CHECK (public.is_admin_or_editor(auth.uid()));

-- Listener stats (aggregated samples)
CREATE TABLE public.listener_stats (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  station_id uuid NOT NULL,
  mount_path text,
  listeners integer NOT NULL DEFAULT 0,
  peak_listeners integer NOT NULL DEFAULT 0,
  recorded_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX listener_stats_station_idx ON public.listener_stats(station_id, recorded_at DESC);
ALTER TABLE public.listener_stats ENABLE ROW LEVEL SECURITY;
CREATE POLICY listener_stats_select_auth ON public.listener_stats FOR SELECT TO authenticated USING (true);
CREATE POLICY listener_stats_insert_editor ON public.listener_stats FOR INSERT TO authenticated WITH CHECK (public.is_admin_or_editor(auth.uid()));

-- Service health (heartbeats from icecast / liquidsoap / worker)
CREATE TABLE public.service_health (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  station_id uuid,
  service text NOT NULL,
  status text NOT NULL DEFAULT 'unknown',
  message text,
  details jsonb,
  reported_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX service_health_idx ON public.service_health(service, reported_at DESC);
ALTER TABLE public.service_health ENABLE ROW LEVEL SECURITY;
CREATE POLICY service_health_select_auth ON public.service_health FOR SELECT TO authenticated USING (true);
CREATE POLICY service_health_insert_editor ON public.service_health FOR INSERT TO authenticated WITH CHECK (public.is_admin_or_editor(auth.uid()));

-- Stack ingest tokens (for the docker stack to call /api/public/* with HMAC or bearer)
CREATE TABLE public.stack_tokens (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  station_id uuid,
  name text NOT NULL,
  token_hash text NOT NULL,
  last_used_at timestamptz,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.stack_tokens ENABLE ROW LEVEL SECURITY;
CREATE POLICY stack_tokens_admin_all ON public.stack_tokens FOR ALL TO authenticated USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));
