
CREATE TABLE public.storage_objects (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  bucket_type text NOT NULL CHECK (bucket_type IN ('media','artwork','public')),
  bucket text NOT NULL,
  object_key text NOT NULL,
  content_type text,
  size_bytes bigint,
  public_url text,
  uploaded_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  station_id uuid REFERENCES public.stations(id) ON DELETE SET NULL,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (bucket, object_key)
);

CREATE INDEX idx_storage_objects_bucket_type ON public.storage_objects(bucket_type);
CREATE INDEX idx_storage_objects_station ON public.storage_objects(station_id);
CREATE INDEX idx_storage_objects_created ON public.storage_objects(created_at DESC);

ALTER TABLE public.storage_objects ENABLE ROW LEVEL SECURITY;

CREATE POLICY "authenticated read storage objects"
  ON public.storage_objects FOR SELECT
  TO authenticated USING (true);

CREATE POLICY "editors insert storage objects"
  ON public.storage_objects FOR INSERT
  TO authenticated
  WITH CHECK (public.is_admin_or_editor(auth.uid()));

CREATE POLICY "editors update storage objects"
  ON public.storage_objects FOR UPDATE
  TO authenticated
  USING (public.is_admin_or_editor(auth.uid()));

CREATE POLICY "editors delete storage objects"
  ON public.storage_objects FOR DELETE
  TO authenticated
  USING (public.is_admin_or_editor(auth.uid()));

CREATE TRIGGER trg_storage_objects_updated_at
  BEFORE UPDATE ON public.storage_objects
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
