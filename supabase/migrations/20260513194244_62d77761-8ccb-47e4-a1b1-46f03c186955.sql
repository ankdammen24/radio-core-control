DROP POLICY IF EXISTS stream_mounts_insert_editor ON public.stream_mounts;
DROP POLICY IF EXISTS stream_mounts_insert_admin ON public.stream_mounts;
CREATE POLICY stream_mounts_insert_admin
ON public.stream_mounts
FOR INSERT
TO authenticated
WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));