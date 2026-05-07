CREATE TABLE public.voicetracks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  station_id UUID NOT NULL,
  title TEXT NOT NULL,
  description TEXT,
  presenter_id UUID,
  duration_seconds NUMERIC,
  status TEXT NOT NULL DEFAULT 'draft',
  azuracast_media_id TEXT,
  azuracast_path TEXT,
  recorded_by UUID,
  error_message TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.voicetracks ENABLE ROW LEVEL SECURITY;

CREATE POLICY voicetracks_select_auth ON public.voicetracks FOR SELECT TO authenticated USING (true);
CREATE POLICY voicetracks_insert_editor ON public.voicetracks FOR INSERT TO authenticated WITH CHECK (public.is_admin_or_editor(auth.uid()));
CREATE POLICY voicetracks_update_editor ON public.voicetracks FOR UPDATE TO authenticated USING (public.is_admin_or_editor(auth.uid())) WITH CHECK (public.is_admin_or_editor(auth.uid()));
CREATE POLICY voicetracks_delete_admin  ON public.voicetracks FOR DELETE TO authenticated USING (public.has_role(auth.uid(), 'admin'::app_role));

CREATE TRIGGER voicetracks_set_updated_at BEFORE UPDATE ON public.voicetracks FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();