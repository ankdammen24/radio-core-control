
-- ============ ENUMS ============
CREATE TYPE public.app_role AS ENUM ('admin', 'editor', 'viewer');
CREATE TYPE public.media_status AS ENUM ('imported', 'missing_metadata', 'ready', 'synced', 'error', 'paused');
CREATE TYPE public.rights_status AS ENUM ('unknown', 'cleared', 'ai_generated', 'local_permission', 'creative_commons', 'needs_review', 'blocked');
CREATE TYPE public.sync_job_status AS ENUM ('pending', 'running', 'completed', 'failed');
CREATE TYPE public.playlist_type AS ENUM ('rotation', 'jingle', 'sweeper', 'promo', 'special', 'paused');
CREATE TYPE public.day_of_week AS ENUM ('mon','tue','wed','thu','fri','sat','sun');
CREATE TYPE public.connection_status AS ENUM ('untested','ok','error');

-- ============ updated_at trigger ============
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END; $$;

-- ============ PROFILES ============
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT,
  display_name TEXT,
  avatar_url TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
CREATE TRIGGER trg_profiles_updated BEFORE UPDATE ON public.profiles FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ============ USER_ROLES ============
CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role app_role NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(user_id, role)
);
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role app_role)
RETURNS BOOLEAN LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role)
$$;

CREATE OR REPLACE FUNCTION public.is_admin_or_editor(_user_id UUID)
RETURNS BOOLEAN LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role IN ('admin','editor'))
$$;

-- ============ Auto-create profile + default viewer role on signup ============
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.profiles (id, email, display_name)
  VALUES (NEW.id, NEW.email, COALESCE(NEW.raw_user_meta_data->>'display_name', split_part(NEW.email,'@',1)));
  -- First user becomes admin, otherwise viewer
  IF (SELECT count(*) FROM public.user_roles) = 0 THEN
    INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'admin');
  ELSE
    INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'viewer');
  END IF;
  RETURN NEW;
END; $$;

CREATE TRIGGER on_auth_user_created AFTER INSERT ON auth.users FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ============ ROLES (descriptive, separate from app_role enum) ============
CREATE TABLE public.roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL UNIQUE,
  description TEXT,
  permissions JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.roles ENABLE ROW LEVEL SECURITY;
CREATE TRIGGER trg_roles_updated BEFORE UPDATE ON public.roles FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ============ ACCOUNTS ============
CREATE TABLE public.accounts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  type TEXT,
  contact_email TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.accounts ENABLE ROW LEVEL SECURITY;
CREATE TRIGGER trg_accounts_updated BEFORE UPDATE ON public.accounts FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ============ STATIONS ============
CREATE TABLE public.stations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id UUID REFERENCES public.accounts(id) ON DELETE SET NULL,
  name TEXT NOT NULL,
  slug TEXT UNIQUE NOT NULL,
  description TEXT,
  azuracast_station_id TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.stations ENABLE ROW LEVEL SECURITY;
CREATE TRIGGER trg_stations_updated BEFORE UPDATE ON public.stations FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ============ STORAGE_LOCATIONS ============
CREATE TABLE public.storage_locations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  type TEXT NOT NULL DEFAULT 'local',
  base_path TEXT,
  description TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.storage_locations ENABLE ROW LEVEL SECURITY;
CREATE TRIGGER trg_storage_locations_updated BEFORE UPDATE ON public.storage_locations FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ============ MEDIA_FILES ============
CREATE TABLE public.media_files (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  station_id UUID REFERENCES public.stations(id) ON DELETE CASCADE,
  file_name TEXT NOT NULL,
  original_file_name TEXT,
  file_path TEXT,
  file_type TEXT,
  mime_type TEXT,
  file_size BIGINT,
  duration_seconds NUMERIC,
  checksum TEXT,
  storage_location_id UUID REFERENCES public.storage_locations(id) ON DELETE SET NULL,
  azuracast_media_id TEXT,
  status media_status NOT NULL DEFAULT 'imported',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.media_files ENABLE ROW LEVEL SECURITY;
CREATE INDEX idx_media_files_station ON public.media_files(station_id);
CREATE INDEX idx_media_files_status ON public.media_files(status);
CREATE TRIGGER trg_media_files_updated BEFORE UPDATE ON public.media_files FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ============ TRACK_METADATA ============
CREATE TABLE public.track_metadata (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  media_file_id UUID NOT NULL REFERENCES public.media_files(id) ON DELETE CASCADE UNIQUE,
  artist TEXT,
  title TEXT,
  album TEXT,
  genre TEXT,
  mood TEXT,
  tempo TEXT,
  language TEXT,
  year INT,
  is_local_music BOOLEAN NOT NULL DEFAULT false,
  is_ai_generated BOOLEAN NOT NULL DEFAULT false,
  rights_status rights_status NOT NULL DEFAULT 'unknown',
  stim_status TEXT,
  explicit_content BOOLEAN NOT NULL DEFAULT false,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.track_metadata ENABLE ROW LEVEL SECURITY;
CREATE TRIGGER trg_track_metadata_updated BEFORE UPDATE ON public.track_metadata FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ============ PLAYLISTS ============
CREATE TABLE public.playlists (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  station_id UUID NOT NULL REFERENCES public.stations(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  azuracast_playlist_id TEXT,
  playlist_type playlist_type NOT NULL DEFAULT 'rotation',
  priority INT NOT NULL DEFAULT 5,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.playlists ENABLE ROW LEVEL SECURITY;
CREATE TRIGGER trg_playlists_updated BEFORE UPDATE ON public.playlists FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ============ PLAYLIST_ASSIGNMENTS ============
CREATE TABLE public.playlist_assignments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  playlist_id UUID NOT NULL REFERENCES public.playlists(id) ON DELETE CASCADE,
  media_file_id UUID NOT NULL REFERENCES public.media_files(id) ON DELETE CASCADE,
  weight INT NOT NULL DEFAULT 1,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(playlist_id, media_file_id)
);
ALTER TABLE public.playlist_assignments ENABLE ROW LEVEL SECURITY;

-- ============ ROTATION_RULES ============
CREATE TABLE public.rotation_rules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  station_id UUID NOT NULL REFERENCES public.stations(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  category TEXT,
  min_minutes_between_same_artist INT NOT NULL DEFAULT 30,
  min_minutes_between_same_track INT NOT NULL DEFAULT 120,
  max_tracks_per_hour INT NOT NULL DEFAULT 12,
  priority INT NOT NULL DEFAULT 5,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.rotation_rules ENABLE ROW LEVEL SECURITY;
CREATE TRIGGER trg_rotation_rules_updated BEFORE UPDATE ON public.rotation_rules FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ============ SCHEDULE_BLOCKS ============
CREATE TABLE public.schedule_blocks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  station_id UUID NOT NULL REFERENCES public.stations(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  day_of_week day_of_week NOT NULL,
  start_time TIME NOT NULL,
  end_time TIME NOT NULL,
  playlist_id UUID REFERENCES public.playlists(id) ON DELETE SET NULL,
  rotation_rule_id UUID REFERENCES public.rotation_rules(id) ON DELETE SET NULL,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.schedule_blocks ENABLE ROW LEVEL SECURITY;
CREATE TRIGGER trg_schedule_blocks_updated BEFORE UPDATE ON public.schedule_blocks FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ============ AZURACAST_CONNECTIONS ============
CREATE TABLE public.azuracast_connections (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  station_id UUID NOT NULL REFERENCES public.stations(id) ON DELETE CASCADE,
  base_url TEXT,
  api_key_secret_name TEXT,
  azuracast_station_id TEXT,
  status connection_status NOT NULL DEFAULT 'untested',
  last_tested_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.azuracast_connections ENABLE ROW LEVEL SECURITY;
CREATE TRIGGER trg_azuracast_connections_updated BEFORE UPDATE ON public.azuracast_connections FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ============ SYNC_JOBS ============
CREATE TABLE public.sync_jobs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  station_id UUID REFERENCES public.stations(id) ON DELETE CASCADE,
  job_type TEXT NOT NULL,
  status sync_job_status NOT NULL DEFAULT 'pending',
  message TEXT,
  payload JSONB,
  result JSONB,
  started_at TIMESTAMPTZ,
  finished_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.sync_jobs ENABLE ROW LEVEL SECURITY;
CREATE INDEX idx_sync_jobs_status ON public.sync_jobs(status);

-- ============ AUDIT_LOGS ============
CREATE TABLE public.audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  station_id UUID REFERENCES public.stations(id) ON DELETE SET NULL,
  action TEXT NOT NULL,
  entity_type TEXT,
  entity_id UUID,
  old_value JSONB,
  new_value JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;

-- ============ SYSTEM_SETTINGS ============
CREATE TABLE public.system_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  key TEXT NOT NULL UNIQUE,
  value JSONB,
  description TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.system_settings ENABLE ROW LEVEL SECURITY;
CREATE TRIGGER trg_system_settings_updated BEFORE UPDATE ON public.system_settings FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ============ RLS POLICIES ============
-- Profiles
CREATE POLICY "profiles_select_authenticated" ON public.profiles FOR SELECT TO authenticated USING (true);
CREATE POLICY "profiles_update_self_or_admin" ON public.profiles FOR UPDATE TO authenticated USING (id = auth.uid() OR public.has_role(auth.uid(),'admin'));
CREATE POLICY "profiles_insert_admin" ON public.profiles FOR INSERT TO authenticated WITH CHECK (public.has_role(auth.uid(),'admin'));

-- user_roles
CREATE POLICY "user_roles_select_auth" ON public.user_roles FOR SELECT TO authenticated USING (true);
CREATE POLICY "user_roles_admin_all" ON public.user_roles FOR ALL TO authenticated USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));

-- Generic helper: build read+write policies for editor tables
DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['roles','accounts','stations','storage_locations','media_files','track_metadata','playlists','playlist_assignments','rotation_rules','schedule_blocks','azuracast_connections','sync_jobs','system_settings']
  LOOP
    EXECUTE format('CREATE POLICY "%I_select_auth" ON public.%I FOR SELECT TO authenticated USING (true);', t, t);
    EXECUTE format('CREATE POLICY "%I_insert_editor" ON public.%I FOR INSERT TO authenticated WITH CHECK (public.is_admin_or_editor(auth.uid()));', t, t);
    EXECUTE format('CREATE POLICY "%I_update_editor" ON public.%I FOR UPDATE TO authenticated USING (public.is_admin_or_editor(auth.uid())) WITH CHECK (public.is_admin_or_editor(auth.uid()));', t, t);
    EXECUTE format('CREATE POLICY "%I_delete_admin" ON public.%I FOR DELETE TO authenticated USING (public.has_role(auth.uid(),''admin''));', t, t);
  END LOOP;
END $$;

-- audit_logs: anyone authenticated can read; insert allowed for any authenticated user
CREATE POLICY "audit_logs_select_auth" ON public.audit_logs FOR SELECT TO authenticated USING (true);
CREATE POLICY "audit_logs_insert_auth" ON public.audit_logs FOR INSERT TO authenticated WITH CHECK (auth.uid() IS NOT NULL);
