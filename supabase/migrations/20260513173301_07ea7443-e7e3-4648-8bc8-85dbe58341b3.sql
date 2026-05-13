
DO $$ BEGIN
  CREATE TYPE public.runtime_target_type AS ENUM ('azuracast','icecast','liquidsoap','stereo_tool','custom');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.runtime_target_status AS ENUM ('unknown','ok','degraded','down','error');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS public.runtime_targets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  station_id uuid NOT NULL,
  name text NOT NULL,
  type public.runtime_target_type NOT NULL,
  base_url text,
  api_key_secret_name text,
  external_station_id text,
  status public.runtime_target_status NOT NULL DEFAULT 'unknown',
  last_checked_at timestamptz,
  last_error text,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS runtime_targets_station_idx ON public.runtime_targets(station_id);

ALTER TABLE public.runtime_targets ENABLE ROW LEVEL SECURITY;

CREATE POLICY "runtime_targets_select_auth" ON public.runtime_targets
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "runtime_targets_insert_editor" ON public.runtime_targets
  FOR INSERT TO authenticated WITH CHECK (public.is_admin_or_editor(auth.uid()));
CREATE POLICY "runtime_targets_update_editor" ON public.runtime_targets
  FOR UPDATE TO authenticated USING (public.is_admin_or_editor(auth.uid()))
  WITH CHECK (public.is_admin_or_editor(auth.uid()));
CREATE POLICY "runtime_targets_delete_admin" ON public.runtime_targets
  FOR DELETE TO authenticated USING (public.has_role(auth.uid(),'admin'));

CREATE TRIGGER runtime_targets_set_updated_at
  BEFORE UPDATE ON public.runtime_targets
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TABLE IF NOT EXISTS public.runtime_health_checks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  target_id uuid NOT NULL REFERENCES public.runtime_targets(id) ON DELETE CASCADE,
  station_id uuid NOT NULL,
  status public.runtime_target_status NOT NULL DEFAULT 'unknown',
  started_at timestamptz NOT NULL DEFAULT now(),
  finished_at timestamptz,
  duration_ms integer,
  error_message text,
  details jsonb NOT NULL DEFAULT '{}'::jsonb,
  triggered_by uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS runtime_health_checks_target_idx ON public.runtime_health_checks(target_id, started_at DESC);
CREATE INDEX IF NOT EXISTS runtime_health_checks_station_idx ON public.runtime_health_checks(station_id, started_at DESC);

ALTER TABLE public.runtime_health_checks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "runtime_health_checks_select_auth" ON public.runtime_health_checks
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "runtime_health_checks_insert_editor" ON public.runtime_health_checks
  FOR INSERT TO authenticated WITH CHECK (public.is_admin_or_editor(auth.uid()));
