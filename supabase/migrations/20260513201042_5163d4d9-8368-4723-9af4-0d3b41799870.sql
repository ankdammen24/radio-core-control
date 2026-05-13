-- 1. Agent status enum
DO $$ BEGIN
  CREATE TYPE public.agent_status AS ENUM ('unknown','online','degraded','offline');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- 2. System event level enum
DO $$ BEGIN
  CREATE TYPE public.system_event_level AS ENUM ('info','warning','error','critical');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- 3. stack_tokens.purpose
ALTER TABLE public.stack_tokens
  ADD COLUMN IF NOT EXISTS purpose text NOT NULL DEFAULT 'api';

-- 4. agent_instances
CREATE TABLE IF NOT EXISTS public.agent_instances (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  station_id uuid NULL,
  name text NOT NULL,
  hostname text NULL,
  version text NULL,
  status public.agent_status NOT NULL DEFAULT 'unknown',
  capabilities jsonb NOT NULL DEFAULT '{}'::jsonb,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  stack_token_id uuid NULL REFERENCES public.stack_tokens(id) ON DELETE SET NULL,
  last_seen_at timestamptz NULL,
  last_error text NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_agent_instances_station ON public.agent_instances(station_id);
CREATE INDEX IF NOT EXISTS idx_agent_instances_status ON public.agent_instances(status);

ALTER TABLE public.agent_instances ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS agent_instances_select_admin_editor ON public.agent_instances;
CREATE POLICY agent_instances_select_admin_editor ON public.agent_instances
  FOR SELECT TO authenticated USING (public.is_admin_or_editor(auth.uid()));

DROP POLICY IF EXISTS agent_instances_insert_admin ON public.agent_instances;
CREATE POLICY agent_instances_insert_admin ON public.agent_instances
  FOR INSERT TO authenticated WITH CHECK (public.has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS agent_instances_update_admin ON public.agent_instances;
CREATE POLICY agent_instances_update_admin ON public.agent_instances
  FOR UPDATE TO authenticated USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS agent_instances_delete_admin ON public.agent_instances;
CREATE POLICY agent_instances_delete_admin ON public.agent_instances
  FOR DELETE TO authenticated USING (public.has_role(auth.uid(), 'admin'));

DROP TRIGGER IF EXISTS agent_instances_set_updated_at ON public.agent_instances;
CREATE TRIGGER agent_instances_set_updated_at
  BEFORE UPDATE ON public.agent_instances
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS agent_instances_audit ON public.agent_instances;
CREATE TRIGGER agent_instances_audit
  AFTER INSERT OR UPDATE OR DELETE ON public.agent_instances
  FOR EACH ROW EXECUTE FUNCTION public.audit_trigger();

-- 5. system_events
CREATE TABLE IF NOT EXISTS public.system_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  station_id uuid NULL,
  source text NOT NULL DEFAULT 'web',
  level public.system_event_level NOT NULL DEFAULT 'info',
  event_type text NOT NULL,
  message text NULL,
  details jsonb NOT NULL DEFAULT '{}'::jsonb,
  actor_user_id uuid NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_system_events_station_created ON public.system_events(station_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_system_events_level_created ON public.system_events(level, created_at DESC);

ALTER TABLE public.system_events ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS system_events_select_auth ON public.system_events;
CREATE POLICY system_events_select_auth ON public.system_events
  FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS system_events_insert_admin_editor ON public.system_events;
CREATE POLICY system_events_insert_admin_editor ON public.system_events
  FOR INSERT TO authenticated WITH CHECK (public.is_admin_or_editor(auth.uid()));