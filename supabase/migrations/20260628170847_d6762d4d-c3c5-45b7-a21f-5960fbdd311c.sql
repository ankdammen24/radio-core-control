-- News lifecycle enum
DO $$ BEGIN
  CREATE TYPE public.news_status AS ENUM (
    'draft','processing','ready_for_radio','broadcasted','archived','expired'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.news_priority AS ENUM ('low','normal','high','breaking');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS public.news_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  short_title text,
  summary text,
  full_article text,
  radio_script text,
  region text,
  municipality text,
  category text,
  priority public.news_priority NOT NULL DEFAULT 'normal',
  language text NOT NULL DEFAULT 'sv',
  source text,
  tags text[] NOT NULL DEFAULT '{}',
  estimated_duration_seconds integer,
  audio_url text,
  image_url text,
  status public.news_status NOT NULL DEFAULT 'draft',
  external_id text,
  published_at timestamptz,
  expires_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS news_items_status_idx ON public.news_items(status);
CREATE INDEX IF NOT EXISTS news_items_published_idx ON public.news_items(published_at DESC);
CREATE INDEX IF NOT EXISTS news_items_region_idx ON public.news_items(region);
CREATE UNIQUE INDEX IF NOT EXISTS news_items_external_uidx ON public.news_items(source, external_id) WHERE external_id IS NOT NULL;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.news_items TO authenticated;
GRANT ALL ON public.news_items TO service_role;
ALTER TABLE public.news_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "news_items editors read" ON public.news_items FOR SELECT TO authenticated
  USING (public.is_admin_or_editor(auth.uid()));
CREATE POLICY "news_items editors insert" ON public.news_items FOR INSERT TO authenticated
  WITH CHECK (public.is_admin_or_editor(auth.uid()));
CREATE POLICY "news_items editors update" ON public.news_items FOR UPDATE TO authenticated
  USING (public.is_admin_or_editor(auth.uid())) WITH CHECK (public.is_admin_or_editor(auth.uid()));
CREATE POLICY "news_items admin delete" ON public.news_items FOR DELETE TO authenticated
  USING (public.has_role(auth.uid(),'admin'));

CREATE TRIGGER trg_news_items_updated_at
  BEFORE UPDATE ON public.news_items
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE OR REPLACE FUNCTION public.validate_news_item()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF length(NEW.title) < 2 OR length(NEW.title) > 500 THEN
    RAISE EXCEPTION 'news title must be 2-500 chars';
  END IF;
  IF NEW.estimated_duration_seconds IS NOT NULL
     AND (NEW.estimated_duration_seconds < 0 OR NEW.estimated_duration_seconds > 7200) THEN
    RAISE EXCEPTION 'duration out of range';
  END IF;
  IF NEW.published_at IS NOT NULL AND NEW.expires_at IS NOT NULL
     AND NEW.expires_at <= NEW.published_at THEN
    RAISE EXCEPTION 'expires_at must be after published_at';
  END IF;
  RETURN NEW;
END $$;

CREATE TRIGGER trg_news_items_validate
  BEFORE INSERT OR UPDATE ON public.news_items
  FOR EACH ROW EXECUTE FUNCTION public.validate_news_item();

-- Broadcast history
CREATE TABLE IF NOT EXISTS public.news_broadcast_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  news_item_id uuid NOT NULL REFERENCES public.news_items(id) ON DELETE CASCADE,
  station_id uuid NOT NULL REFERENCES public.stations(id) ON DELETE CASCADE,
  broadcast_time timestamptz NOT NULL DEFAULT now(),
  program_name text,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS nbh_news_idx ON public.news_broadcast_history(news_item_id);
CREATE INDEX IF NOT EXISTS nbh_station_idx ON public.news_broadcast_history(station_id, broadcast_time DESC);

GRANT SELECT ON public.news_broadcast_history TO authenticated;
GRANT ALL ON public.news_broadcast_history TO service_role;
ALTER TABLE public.news_broadcast_history ENABLE ROW LEVEL SECURITY;

CREATE POLICY "nbh editors read" ON public.news_broadcast_history FOR SELECT TO authenticated
  USING (public.is_admin_or_editor(auth.uid()));
