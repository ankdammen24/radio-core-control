
-- accounts: restrict SELECT to admin/editor
DROP POLICY IF EXISTS accounts_select_auth ON public.accounts;
CREATE POLICY accounts_select_admin_editor ON public.accounts
  FOR SELECT TO authenticated
  USING (public.is_admin_or_editor(auth.uid()));

-- liquidsoap_configs: restrict SELECT to admin only
DROP POLICY IF EXISTS liquidsoap_configs_select_auth ON public.liquidsoap_configs;
CREATE POLICY liquidsoap_configs_select_admin ON public.liquidsoap_configs
  FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role));

-- user_roles: restrict SELECT to own row or admin
DROP POLICY IF EXISTS user_roles_select_auth ON public.user_roles;
CREATE POLICY user_roles_select_self_or_admin ON public.user_roles
  FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.has_role(auth.uid(), 'admin'::app_role));

-- system_settings: restrict SELECT to admin only
DROP POLICY IF EXISTS system_settings_select_auth ON public.system_settings;
CREATE POLICY system_settings_select_admin ON public.system_settings
  FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role));

-- runtime_targets: restrict INSERT/UPDATE to admin (match SELECT)
DROP POLICY IF EXISTS runtime_targets_insert_editor ON public.runtime_targets;
DROP POLICY IF EXISTS runtime_targets_update_editor ON public.runtime_targets;
CREATE POLICY runtime_targets_insert_admin ON public.runtime_targets
  FOR INSERT TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY runtime_targets_update_admin ON public.runtime_targets
  FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));

-- storage_objects: restrict SELECT to admin/editor
DROP POLICY IF EXISTS "authenticated read storage objects" ON public.storage_objects;
CREATE POLICY storage_objects_select_admin_editor ON public.storage_objects
  FOR SELECT TO authenticated
  USING (public.is_admin_or_editor(auth.uid()));

-- song_requests: validate station_id references an active station
DROP POLICY IF EXISTS song_requests_insert_public ON public.song_requests;
CREATE POLICY song_requests_insert_public ON public.song_requests
  FOR INSERT TO anon, authenticated
  WITH CHECK (
    length(track_text) >= 1
    AND length(track_text) <= 500
    AND EXISTS (
      SELECT 1 FROM public.stations s
      WHERE s.id = song_requests.station_id AND s.is_active = true
    )
  );

-- Restrict direct EXECUTE on SECURITY DEFINER admin/internal helpers.
-- has_role/is_admin_or_editor remain executable because they are used in RLS policies.
-- handle_new_user/audit_trigger/set_updated_at/validate_* are trigger functions —
-- triggers invoke them regardless of EXECUTE grants, but anon/authenticated should not call them directly.
REVOKE EXECUTE ON FUNCTION public.claim_sync_jobs(integer, text) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.delete_station_cascade(uuid) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.audit_trigger() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.set_updated_at() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.validate_station() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.validate_account() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.validate_schedule_block() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.validate_rotation_rule() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.validate_streaming_output() FROM PUBLIC, anon, authenticated;
