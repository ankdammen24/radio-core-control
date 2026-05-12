
-- Enable pg_cron + pg_net for scheduled outbound HTTP
CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;

-- Add retry/scheduling fields to sync_jobs
ALTER TABLE public.sync_jobs
  ADD COLUMN IF NOT EXISTS attempts integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS max_attempts integer NOT NULL DEFAULT 5,
  ADD COLUMN IF NOT EXISTS scheduled_for timestamptz NOT NULL DEFAULT now(),
  ADD COLUMN IF NOT EXISTS locked_at timestamptz,
  ADD COLUMN IF NOT EXISTS locked_by text;

CREATE INDEX IF NOT EXISTS sync_jobs_pending_idx
  ON public.sync_jobs (status, scheduled_for)
  WHERE status = 'pending';

CREATE INDEX IF NOT EXISTS sync_jobs_station_type_idx
  ON public.sync_jobs (station_id, job_type, created_at DESC);

-- Atomic claim function: pick up to N pending jobs and mark them running
CREATE OR REPLACE FUNCTION public.claim_sync_jobs(
  _limit integer DEFAULT 10,
  _worker text DEFAULT 'cron'
)
RETURNS SETOF public.sync_jobs
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  WITH picked AS (
    SELECT id FROM public.sync_jobs
    WHERE status = 'pending'
      AND scheduled_for <= now()
      AND attempts < max_attempts
    ORDER BY scheduled_for ASC
    LIMIT _limit
    FOR UPDATE SKIP LOCKED
  )
  UPDATE public.sync_jobs s
  SET status = 'running',
      started_at = now(),
      locked_at = now(),
      locked_by = _worker,
      attempts = s.attempts + 1
  FROM picked
  WHERE s.id = picked.id
  RETURNING s.*;
END;
$$;

REVOKE ALL ON FUNCTION public.claim_sync_jobs(integer, text) FROM PUBLIC;

-- Schedule the worker cron to ping the public endpoint every minute.
-- Uses the project's stable preview URL; switch to project--<id>.lovable.app
-- (the published URL) once Live is the source of truth.
SELECT cron.schedule(
  'azuracast-sync-worker',
  '* * * * *',
  $cron$
  SELECT net.http_post(
    url := 'https://project--d75758a1-2ff8-4a21-b991-66b7965206c8.lovable.app/api/public/cron/sync-worker',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'apikey', 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImllcWp4bHRmdWp6emdwZnFzbnJoIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzgwNjM3NzYsImV4cCI6MjA5MzYzOTc3Nn0.-O9RtRwoNWvDrjJojfMKLODcxzuq6y5r1C_V8kLVxzs'
    ),
    body := jsonb_build_object('source', 'pg_cron')
  );
  $cron$
);

-- Pull-jobs: now playing every 30 sec via TWO cron entries (pg_cron min granularity = 1 min)
SELECT cron.schedule(
  'azuracast-pull-now-playing',
  '* * * * *',
  $cron$
  INSERT INTO public.sync_jobs (job_type, status, payload, scheduled_for)
  SELECT 'azuracast.pull.now_playing', 'pending', jsonb_build_object('connection_id', id), now()
  FROM public.azuracast_connections
  WHERE base_url IS NOT NULL AND azuracast_station_id IS NOT NULL;
  $cron$
);

SELECT cron.schedule(
  'azuracast-pull-listeners',
  '*/5 * * * *',
  $cron$
  INSERT INTO public.sync_jobs (job_type, status, payload, scheduled_for)
  SELECT 'azuracast.pull.listeners', 'pending', jsonb_build_object('connection_id', id), now()
  FROM public.azuracast_connections
  WHERE base_url IS NOT NULL AND azuracast_station_id IS NOT NULL;
  $cron$
);
