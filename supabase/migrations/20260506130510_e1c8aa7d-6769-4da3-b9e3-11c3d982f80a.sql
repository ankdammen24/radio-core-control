
CREATE TABLE public.live_inputs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  station_id uuid NOT NULL,
  mount_path text NOT NULL DEFAULT '/live',
  harbor_port integer NOT NULL DEFAULT 8005,
  source_user text NOT NULL DEFAULT 'source',
  source_password text NOT NULL DEFAULT 'changeme',
  format text NOT NULL DEFAULT 'mp3',
  bitrate integer NOT NULL DEFAULT 192,
  auto_takeover boolean NOT NULL DEFAULT true,
  fade_in_seconds numeric NOT NULL DEFAULT 1.5,
  fade_out_seconds numeric NOT NULL DEFAULT 2.0,
  is_enabled boolean NOT NULL DEFAULT true,
  is_live boolean NOT NULL DEFAULT false,
  forced_takeover boolean NOT NULL DEFAULT false,
  last_state_change timestamptz,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(station_id)
);

ALTER TABLE public.live_inputs ENABLE ROW LEVEL SECURITY;

CREATE POLICY live_inputs_select_auth ON public.live_inputs FOR SELECT TO authenticated USING (true);
CREATE POLICY live_inputs_insert_admin ON public.live_inputs FOR INSERT TO authenticated WITH CHECK (has_role(auth.uid(),'admin'));
CREATE POLICY live_inputs_update_editor ON public.live_inputs FOR UPDATE TO authenticated USING (is_admin_or_editor(auth.uid())) WITH CHECK (is_admin_or_editor(auth.uid()));
CREATE POLICY live_inputs_delete_admin ON public.live_inputs FOR DELETE TO authenticated USING (has_role(auth.uid(),'admin'));

CREATE TRIGGER live_inputs_updated_at BEFORE UPDATE ON public.live_inputs FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();


CREATE TABLE public.live_takeover_schedule (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  station_id uuid NOT NULL,
  presenter_id uuid,
  title text NOT NULL,
  starts_at timestamptz NOT NULL,
  ends_at timestamptz NOT NULL,
  auto_activate boolean NOT NULL DEFAULT true,
  notes text,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CHECK (ends_at > starts_at)
);

ALTER TABLE public.live_takeover_schedule ENABLE ROW LEVEL SECURITY;

CREATE POLICY live_sched_select_auth ON public.live_takeover_schedule FOR SELECT TO authenticated USING (true);
CREATE POLICY live_sched_insert_editor ON public.live_takeover_schedule FOR INSERT TO authenticated WITH CHECK (is_admin_or_editor(auth.uid()));
CREATE POLICY live_sched_update_editor ON public.live_takeover_schedule FOR UPDATE TO authenticated USING (is_admin_or_editor(auth.uid())) WITH CHECK (is_admin_or_editor(auth.uid()));
CREATE POLICY live_sched_delete_admin ON public.live_takeover_schedule FOR DELETE TO authenticated USING (has_role(auth.uid(),'admin'));

CREATE TRIGGER live_sched_updated_at BEFORE UPDATE ON public.live_takeover_schedule FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE INDEX live_sched_station_time_idx ON public.live_takeover_schedule (station_id, starts_at, ends_at);


CREATE TABLE public.live_takeover_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  station_id uuid NOT NULL,
  event_type text NOT NULL,
  source text NOT NULL DEFAULT 'manual',
  user_id uuid,
  message text,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.live_takeover_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY live_events_select_auth ON public.live_takeover_events FOR SELECT TO authenticated USING (true);
CREATE POLICY live_events_insert_editor ON public.live_takeover_events FOR INSERT TO authenticated WITH CHECK (is_admin_or_editor(auth.uid()));
