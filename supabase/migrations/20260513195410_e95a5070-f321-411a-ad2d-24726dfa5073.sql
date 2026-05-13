DROP POLICY IF EXISTS song_requests_insert_public ON public.song_requests;

CREATE POLICY song_requests_insert_public
ON public.song_requests
FOR INSERT
TO anon, authenticated
WITH CHECK (
  length(track_text) BETWEEN 1 AND 500
  AND (requester_name IS NULL OR length(requester_name) <= 100)
  AND (contact IS NULL OR length(contact) <= 200)
  AND (message IS NULL OR length(message) <= 1000)
  AND EXISTS (
    SELECT 1 FROM public.stations s
    WHERE s.id = song_requests.station_id AND s.is_active = true
  )
);