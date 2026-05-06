
-- Companion: media kind on existing media_files
ALTER TABLE public.media_files ADD COLUMN IF NOT EXISTS media_kind text NOT NULL DEFAULT 'music';

-- Presenters
CREATE TABLE public.presenters (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  bio text,
  email text,
  avatar_url text,
  color text DEFAULT '#64748b',
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.presenters ENABLE ROW LEVEL SECURITY;
CREATE POLICY presenters_select_auth ON public.presenters FOR SELECT TO authenticated USING (true);
CREATE POLICY presenters_insert_editor ON public.presenters FOR INSERT TO authenticated WITH CHECK (public.is_admin_or_editor(auth.uid()));
CREATE POLICY presenters_update_editor ON public.presenters FOR UPDATE TO authenticated USING (public.is_admin_or_editor(auth.uid())) WITH CHECK (public.is_admin_or_editor(auth.uid()));
CREATE POLICY presenters_delete_admin ON public.presenters FOR DELETE TO authenticated USING (public.has_role(auth.uid(),'admin'));
CREATE TRIGGER presenters_updated BEFORE UPDATE ON public.presenters FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Shows
CREATE TABLE public.shows (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  station_id uuid NOT NULL,
  name text NOT NULL,
  description text,
  presenter_id uuid,
  color text DEFAULT '#3b82f6',
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.shows ENABLE ROW LEVEL SECURITY;
CREATE POLICY shows_select_auth ON public.shows FOR SELECT TO authenticated USING (true);
CREATE POLICY shows_insert_editor ON public.shows FOR INSERT TO authenticated WITH CHECK (public.is_admin_or_editor(auth.uid()));
CREATE POLICY shows_update_editor ON public.shows FOR UPDATE TO authenticated USING (public.is_admin_or_editor(auth.uid())) WITH CHECK (public.is_admin_or_editor(auth.uid()));
CREATE POLICY shows_delete_admin ON public.shows FOR DELETE TO authenticated USING (public.has_role(auth.uid(),'admin'));
CREATE TRIGGER shows_updated BEFORE UPDATE ON public.shows FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Episodes
CREATE TABLE public.episodes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  show_id uuid NOT NULL,
  scheduled_start timestamptz NOT NULL,
  scheduled_end timestamptz NOT NULL,
  status text NOT NULL DEFAULT 'planned',
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX episodes_show_idx ON public.episodes(show_id, scheduled_start DESC);
ALTER TABLE public.episodes ENABLE ROW LEVEL SECURITY;
CREATE POLICY episodes_select_auth ON public.episodes FOR SELECT TO authenticated USING (true);
CREATE POLICY episodes_insert_editor ON public.episodes FOR INSERT TO authenticated WITH CHECK (public.is_admin_or_editor(auth.uid()));
CREATE POLICY episodes_update_editor ON public.episodes FOR UPDATE TO authenticated USING (public.is_admin_or_editor(auth.uid())) WITH CHECK (public.is_admin_or_editor(auth.uid()));
CREATE POLICY episodes_delete_admin ON public.episodes FOR DELETE TO authenticated USING (public.has_role(auth.uid(),'admin'));
CREATE TRIGGER episodes_updated BEFORE UPDATE ON public.episodes FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Rundown items
CREATE TABLE public.rundown_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  episode_id uuid NOT NULL,
  position integer NOT NULL DEFAULT 0,
  item_type text NOT NULL DEFAULT 'talk',
  title text NOT NULL,
  duration_seconds integer NOT NULL DEFAULT 0,
  notes text,
  media_file_id uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX rundown_items_episode_idx ON public.rundown_items(episode_id, position);
ALTER TABLE public.rundown_items ENABLE ROW LEVEL SECURITY;
CREATE POLICY rundown_items_select_auth ON public.rundown_items FOR SELECT TO authenticated USING (true);
CREATE POLICY rundown_items_insert_editor ON public.rundown_items FOR INSERT TO authenticated WITH CHECK (public.is_admin_or_editor(auth.uid()));
CREATE POLICY rundown_items_update_editor ON public.rundown_items FOR UPDATE TO authenticated USING (public.is_admin_or_editor(auth.uid())) WITH CHECK (public.is_admin_or_editor(auth.uid()));
CREATE POLICY rundown_items_delete_editor ON public.rundown_items FOR DELETE TO authenticated USING (public.is_admin_or_editor(auth.uid()));
CREATE TRIGGER rundown_items_updated BEFORE UPDATE ON public.rundown_items FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Ad campaigns
CREATE TABLE public.ad_campaigns (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  station_id uuid NOT NULL,
  advertiser text NOT NULL,
  name text NOT NULL,
  start_date date,
  end_date date,
  daily_target integer NOT NULL DEFAULT 0,
  notes text,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.ad_campaigns ENABLE ROW LEVEL SECURITY;
CREATE POLICY ad_campaigns_select_auth ON public.ad_campaigns FOR SELECT TO authenticated USING (true);
CREATE POLICY ad_campaigns_insert_editor ON public.ad_campaigns FOR INSERT TO authenticated WITH CHECK (public.is_admin_or_editor(auth.uid()));
CREATE POLICY ad_campaigns_update_editor ON public.ad_campaigns FOR UPDATE TO authenticated USING (public.is_admin_or_editor(auth.uid())) WITH CHECK (public.is_admin_or_editor(auth.uid()));
CREATE POLICY ad_campaigns_delete_admin ON public.ad_campaigns FOR DELETE TO authenticated USING (public.has_role(auth.uid(),'admin'));
CREATE TRIGGER ad_campaigns_updated BEFORE UPDATE ON public.ad_campaigns FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Ad spots
CREATE TABLE public.ad_spots (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id uuid NOT NULL,
  media_file_id uuid,
  weight integer NOT NULL DEFAULT 1,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.ad_spots ENABLE ROW LEVEL SECURITY;
CREATE POLICY ad_spots_select_auth ON public.ad_spots FOR SELECT TO authenticated USING (true);
CREATE POLICY ad_spots_insert_editor ON public.ad_spots FOR INSERT TO authenticated WITH CHECK (public.is_admin_or_editor(auth.uid()));
CREATE POLICY ad_spots_update_editor ON public.ad_spots FOR UPDATE TO authenticated USING (public.is_admin_or_editor(auth.uid())) WITH CHECK (public.is_admin_or_editor(auth.uid()));
CREATE POLICY ad_spots_delete_editor ON public.ad_spots FOR DELETE TO authenticated USING (public.is_admin_or_editor(auth.uid()));

-- Song requests (public can insert)
CREATE TABLE public.song_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  station_id uuid NOT NULL,
  requester_name text,
  contact text,
  track_text text NOT NULL,
  message text,
  status text NOT NULL DEFAULT 'new',
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX song_requests_station_idx ON public.song_requests(station_id, created_at DESC);
ALTER TABLE public.song_requests ENABLE ROW LEVEL SECURITY;
CREATE POLICY song_requests_select_auth ON public.song_requests FOR SELECT TO authenticated USING (true);
CREATE POLICY song_requests_insert_public ON public.song_requests FOR INSERT TO authenticated, anon WITH CHECK (length(track_text) BETWEEN 1 AND 500);
CREATE POLICY song_requests_update_editor ON public.song_requests FOR UPDATE TO authenticated USING (public.is_admin_or_editor(auth.uid())) WITH CHECK (public.is_admin_or_editor(auth.uid()));
CREATE POLICY song_requests_delete_admin ON public.song_requests FOR DELETE TO authenticated USING (public.has_role(auth.uid(),'admin'));

-- Studio messages (public can insert)
CREATE TABLE public.studio_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  station_id uuid NOT NULL,
  from_name text,
  body text NOT NULL,
  kind text NOT NULL DEFAULT 'chat',
  handled boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX studio_messages_station_idx ON public.studio_messages(station_id, created_at DESC);
ALTER TABLE public.studio_messages ENABLE ROW LEVEL SECURITY;
CREATE POLICY studio_messages_select_auth ON public.studio_messages FOR SELECT TO authenticated USING (true);
CREATE POLICY studio_messages_insert_public ON public.studio_messages FOR INSERT TO authenticated, anon WITH CHECK (length(body) BETWEEN 1 AND 2000);
CREATE POLICY studio_messages_update_editor ON public.studio_messages FOR UPDATE TO authenticated USING (public.is_admin_or_editor(auth.uid())) WITH CHECK (public.is_admin_or_editor(auth.uid()));
CREATE POLICY studio_messages_delete_admin ON public.studio_messages FOR DELETE TO authenticated USING (public.has_role(auth.uid(),'admin'));
