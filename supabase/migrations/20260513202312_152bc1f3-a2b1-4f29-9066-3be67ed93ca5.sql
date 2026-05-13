DROP POLICY IF EXISTS studio_messages_insert_public ON public.studio_messages;
CREATE POLICY studio_messages_insert_public ON public.studio_messages
  FOR INSERT TO anon, authenticated
  WITH CHECK (
    kind = 'chat'
    AND length(body) >= 1 AND length(body) <= 2000
    AND (from_name IS NULL OR length(from_name) <= 100)
    AND EXISTS (SELECT 1 FROM public.stations s WHERE s.id = studio_messages.station_id AND s.is_active = true)
  );