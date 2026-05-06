
CREATE TYPE public.streaming_output_type AS ENUM (
  'icecast_kh','icecast','shoutcast','hls','relay','srt','rtmp','webrtc'
);

CREATE TABLE public.streaming_outputs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  station_id uuid NOT NULL REFERENCES public.stations(id) ON DELETE CASCADE,
  type public.streaming_output_type NOT NULL DEFAULT 'icecast_kh',
  name text NOT NULL,
  is_enabled boolean NOT NULL DEFAULT true,
  is_public boolean NOT NULL DEFAULT true,
  -- network
  host text NOT NULL DEFAULT 'localhost',
  port integer NOT NULL DEFAULT 8000,
  mountpoint text,
  username text,
  password_secret_name text,        -- name of stored secret (preferred)
  password text,                    -- inline password for non-prod / lab use
  -- audio
  codec text NOT NULL DEFAULT 'mp3',          -- mp3, aac, opus, ogg, flac, h264+aac (rtmp), …
  format text NOT NULL DEFAULT 'audio/mpeg',  -- mime / container
  bitrate integer NOT NULL DEFAULT 128,
  sample_rate integer NOT NULL DEFAULT 44100,
  channels integer NOT NULL DEFAULT 2,
  -- transport
  use_tls boolean NOT NULL DEFAULT false,
  proxy_url text,
  -- monitoring
  listener_stats_url text,         -- where the runner/agent polls listener stats
  health_status text NOT NULL DEFAULT 'unknown', -- unknown|healthy|degraded|down
  last_health_at timestamptz,
  last_listeners integer,
  -- backend-specific knobs
  config jsonb NOT NULL DEFAULT '{}'::jsonb,
  notes text,
  priority integer NOT NULL DEFAULT 10,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (station_id, name)
);

CREATE INDEX streaming_outputs_station_idx ON public.streaming_outputs(station_id);
CREATE INDEX streaming_outputs_type_idx ON public.streaming_outputs(type);

ALTER TABLE public.streaming_outputs ENABLE ROW LEVEL SECURITY;

CREATE POLICY streaming_outputs_select_auth ON public.streaming_outputs
  FOR SELECT TO authenticated USING (true);

CREATE POLICY streaming_outputs_insert_admin ON public.streaming_outputs
  FOR INSERT TO authenticated WITH CHECK (has_role(auth.uid(),'admin'::app_role));

CREATE POLICY streaming_outputs_update_admin ON public.streaming_outputs
  FOR UPDATE TO authenticated
  USING (has_role(auth.uid(),'admin'::app_role))
  WITH CHECK (has_role(auth.uid(),'admin'::app_role));

CREATE POLICY streaming_outputs_delete_admin ON public.streaming_outputs
  FOR DELETE TO authenticated USING (has_role(auth.uid(),'admin'::app_role));

CREATE TRIGGER trg_streaming_outputs_updated
  BEFORE UPDATE ON public.streaming_outputs
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TRIGGER audit_streaming_outputs
  AFTER INSERT OR UPDATE OR DELETE ON public.streaming_outputs
  FOR EACH ROW EXECUTE FUNCTION public.audit_trigger();

-- Validate sane ranges
CREATE OR REPLACE FUNCTION public.validate_streaming_output()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF NEW.port < 1 OR NEW.port > 65535 THEN RAISE EXCEPTION 'Invalid port'; END IF;
  IF NEW.bitrate < 8 OR NEW.bitrate > 4000 THEN RAISE EXCEPTION 'Invalid bitrate'; END IF;
  IF NEW.sample_rate < 8000 OR NEW.sample_rate > 192000 THEN RAISE EXCEPTION 'Invalid sample_rate'; END IF;
  IF NEW.channels NOT IN (1,2) THEN RAISE EXCEPTION 'channels must be 1 or 2'; END IF;
  IF NEW.health_status NOT IN ('unknown','healthy','degraded','down') THEN
    RAISE EXCEPTION 'Invalid health_status';
  END IF;
  RETURN NEW;
END $$;

CREATE TRIGGER validate_streaming_outputs
  BEFORE INSERT OR UPDATE ON public.streaming_outputs
  FOR EACH ROW EXECUTE FUNCTION public.validate_streaming_output();
