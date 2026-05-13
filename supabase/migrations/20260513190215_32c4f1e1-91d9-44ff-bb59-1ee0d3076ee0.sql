-- Restrict storage_targets writes to admin only
DROP POLICY IF EXISTS storage_targets_insert_editor ON public.storage_targets;
DROP POLICY IF EXISTS storage_targets_update_editor ON public.storage_targets;

CREATE POLICY storage_targets_insert_admin ON public.storage_targets
  FOR INSERT TO authenticated
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY storage_targets_update_admin ON public.storage_targets
  FOR UPDATE TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

-- Validate station_id for public studio_messages inserts
DROP POLICY IF EXISTS studio_messages_insert_public ON public.studio_messages;

CREATE POLICY studio_messages_insert_public ON public.studio_messages
  FOR INSERT TO anon, authenticated
  WITH CHECK (
    length(body) >= 1
    AND length(body) <= 2000
    AND EXISTS (
      SELECT 1 FROM public.stations s
      WHERE s.id = studio_messages.station_id AND s.is_active = true
    )
  );