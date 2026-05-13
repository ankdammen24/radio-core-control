-- Tighten stream_mounts UPDATE: admin only (was editor)
DROP POLICY IF EXISTS stream_mounts_update_editor ON public.stream_mounts;
CREATE POLICY stream_mounts_update_admin ON public.stream_mounts
  FOR UPDATE TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

-- Restrict audit_logs INSERT: only the audit_trigger SECURITY DEFINER function should write.
-- Remove direct user INSERT permission.
DROP POLICY IF EXISTS audit_logs_insert_auth ON public.audit_logs;

-- Restrict voicetracks bucket SELECT to admin/editor only
DROP POLICY IF EXISTS "voicetracks bucket read auth" ON storage.objects;
CREATE POLICY "voicetracks bucket read editor" ON storage.objects
  FOR SELECT TO authenticated
  USING (bucket_id = 'voicetracks' AND public.is_admin_or_editor(auth.uid()));