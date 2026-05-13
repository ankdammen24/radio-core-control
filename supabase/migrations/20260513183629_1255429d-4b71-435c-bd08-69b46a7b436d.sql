
-- Helper: tighten SELECT on sensitive tables to admins only

-- icecast_configs
DROP POLICY IF EXISTS icecast_configs_select_auth ON public.icecast_configs;
CREATE POLICY icecast_configs_select_admin ON public.icecast_configs
  FOR SELECT TO authenticated USING (has_role(auth.uid(), 'admin'));

-- live_inputs
DROP POLICY IF EXISTS live_inputs_select_auth ON public.live_inputs;
CREATE POLICY live_inputs_select_admin ON public.live_inputs
  FOR SELECT TO authenticated USING (has_role(auth.uid(), 'admin'));

-- streaming_outputs (table exists per scan)
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='streaming_outputs') THEN
    EXECUTE 'DROP POLICY IF EXISTS streaming_outputs_select_auth ON public.streaming_outputs';
    EXECUTE 'CREATE POLICY streaming_outputs_select_admin ON public.streaming_outputs FOR SELECT TO authenticated USING (has_role(auth.uid(), ''admin''))';
  END IF;
END $$;

-- stream_mounts
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='stream_mounts') THEN
    EXECUTE 'DROP POLICY IF EXISTS stream_mounts_select_auth ON public.stream_mounts';
    EXECUTE 'CREATE POLICY stream_mounts_select_admin ON public.stream_mounts FOR SELECT TO authenticated USING (has_role(auth.uid(), ''admin''))';
  END IF;
END $$;

-- azuracast_connections
DROP POLICY IF EXISTS azuracast_connections_select_auth ON public.azuracast_connections;
CREATE POLICY azuracast_connections_select_admin ON public.azuracast_connections
  FOR SELECT TO authenticated USING (has_role(auth.uid(), 'admin'));

-- runtime_targets
DROP POLICY IF EXISTS runtime_targets_select_auth ON public.runtime_targets;
CREATE POLICY runtime_targets_select_admin ON public.runtime_targets
  FOR SELECT TO authenticated USING (has_role(auth.uid(), 'admin'));

-- storage_targets
DROP POLICY IF EXISTS storage_targets_select_auth ON public.storage_targets;
CREATE POLICY storage_targets_select_admin ON public.storage_targets
  FOR SELECT TO authenticated USING (has_role(auth.uid(), 'admin'));

-- profiles: own row or admin
DROP POLICY IF EXISTS profiles_select_authenticated ON public.profiles;
CREATE POLICY profiles_select_self_or_admin ON public.profiles
  FOR SELECT TO authenticated USING (id = auth.uid() OR has_role(auth.uid(), 'admin'));

-- presenters: editor or admin only (contains email)
DROP POLICY IF EXISTS presenters_select_auth ON public.presenters;
CREATE POLICY presenters_select_editor ON public.presenters
  FOR SELECT TO authenticated USING (is_admin_or_editor(auth.uid()));

-- audit_logs: admin only
DROP POLICY IF EXISTS audit_logs_select_auth ON public.audit_logs;
CREATE POLICY audit_logs_select_admin ON public.audit_logs
  FOR SELECT TO authenticated USING (has_role(auth.uid(), 'admin'));

-- sync_jobs: editor or admin
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='sync_jobs') THEN
    EXECUTE 'DROP POLICY IF EXISTS sync_jobs_select_auth ON public.sync_jobs';
    EXECUTE 'CREATE POLICY sync_jobs_select_editor ON public.sync_jobs FOR SELECT TO authenticated USING (is_admin_or_editor(auth.uid()))';
  END IF;
END $$;

-- song_requests: editor or admin (contains listener contact)
DROP POLICY IF EXISTS song_requests_select_auth ON public.song_requests;
CREATE POLICY song_requests_select_editor ON public.song_requests
  FOR SELECT TO authenticated USING (is_admin_or_editor(auth.uid()));
