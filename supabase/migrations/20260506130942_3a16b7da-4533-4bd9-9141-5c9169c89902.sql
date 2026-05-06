
CREATE TABLE public.fallback_tracks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  station_id uuid NOT NULL,
  media_file_id uuid,
  external_url text,
  label text NOT NULL,
  priority integer NOT NULL DEFAULT 10,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CHECK (media_file_id IS NOT NULL OR external_url IS NOT NULL)
);

ALTER TABLE public.fallback_tracks ENABLE ROW LEVEL SECURITY;

CREATE POLICY fallback_tracks_select_auth ON public.fallback_tracks FOR SELECT TO authenticated USING (true);
CREATE POLICY fallback_tracks_insert_editor ON public.fallback_tracks FOR INSERT TO authenticated WITH CHECK (is_admin_or_editor(auth.uid()));
CREATE POLICY fallback_tracks_update_editor ON public.fallback_tracks FOR UPDATE TO authenticated USING (is_admin_or_editor(auth.uid())) WITH CHECK (is_admin_or_editor(auth.uid()));
CREATE POLICY fallback_tracks_delete_admin ON public.fallback_tracks FOR DELETE TO authenticated USING (has_role(auth.uid(),'admin'));

CREATE TRIGGER fallback_tracks_updated_at BEFORE UPDATE ON public.fallback_tracks FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE INDEX fallback_tracks_station_priority_idx ON public.fallback_tracks (station_id, priority);
