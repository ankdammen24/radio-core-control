-- Storage Targets: a generic storage-provider registry for Radio Core.
DO $$ BEGIN
  CREATE TYPE public.storage_provider AS ENUM ('r2','s3','local','azure_blob','external_url');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.storage_purpose AS ENUM ('media','artwork','cdn','backup','exports');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.storage_status AS ENUM ('unknown','online','warning','offline');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS public.storage_targets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  station_id uuid NOT NULL,
  name text NOT NULL,
  provider public.storage_provider NOT NULL,
  purpose public.storage_purpose NOT NULL DEFAULT 'media',
  bucket text,
  endpoint_url text,
  region text,
  public_base_url text,
  access_key_ref text,
  secret_key_ref text,
  status public.storage_status NOT NULL DEFAULT 'unknown',
  last_checked_at timestamptz,
  last_error text,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS storage_targets_station_idx ON public.storage_targets(station_id);
CREATE INDEX IF NOT EXISTS storage_targets_provider_idx ON public.storage_targets(provider);

ALTER TABLE public.storage_targets ENABLE ROW LEVEL SECURITY;

CREATE POLICY "storage_targets_select_auth" ON public.storage_targets
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "storage_targets_insert_editor" ON public.storage_targets
  FOR INSERT TO authenticated WITH CHECK (public.is_admin_or_editor(auth.uid()));
CREATE POLICY "storage_targets_update_editor" ON public.storage_targets
  FOR UPDATE TO authenticated USING (public.is_admin_or_editor(auth.uid()))
  WITH CHECK (public.is_admin_or_editor(auth.uid()));
CREATE POLICY "storage_targets_delete_admin" ON public.storage_targets
  FOR DELETE TO authenticated USING (public.has_role(auth.uid(),'admin'));

CREATE TRIGGER storage_targets_set_updated_at
  BEFORE UPDATE ON public.storage_targets
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Track per-target health checks (separate from runtime_health_checks)
CREATE TABLE IF NOT EXISTS public.storage_health_checks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  target_id uuid NOT NULL REFERENCES public.storage_targets(id) ON DELETE CASCADE,
  station_id uuid NOT NULL,
  status public.storage_status NOT NULL DEFAULT 'unknown',
  started_at timestamptz NOT NULL DEFAULT now(),
  finished_at timestamptz,
  duration_ms integer,
  error_message text,
  details jsonb NOT NULL DEFAULT '{}'::jsonb,
  triggered_by uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS storage_health_checks_target_idx ON public.storage_health_checks(target_id, started_at DESC);

ALTER TABLE public.storage_health_checks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "storage_health_checks_select_auth" ON public.storage_health_checks
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "storage_health_checks_insert_editor" ON public.storage_health_checks
  FOR INSERT TO authenticated WITH CHECK (public.is_admin_or_editor(auth.uid()));