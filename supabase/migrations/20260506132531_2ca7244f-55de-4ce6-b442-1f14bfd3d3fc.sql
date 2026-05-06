ALTER TABLE public.stations
  ADD COLUMN IF NOT EXISTS demo_mode boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS demo_stream_url text,
  ADD COLUMN IF NOT EXISTS demo_artwork_url text;