DROP TABLE IF EXISTS public.stereo_tool_events CASCADE;
DROP TABLE IF EXISTS public.stereo_tool_configs CASCADE;
DROP TABLE IF EXISTS public.stereo_tool_presets CASCADE;

CREATE OR REPLACE FUNCTION public.delete_station_cascade(sid uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  DELETE FROM playlist_assignments WHERE playlist_id IN (SELECT id FROM playlists WHERE station_id=sid);
  DELETE FROM schedule_blocks WHERE station_id=sid;
  DELETE FROM fallback_tracks WHERE station_id=sid;
  DELETE FROM playlists WHERE station_id=sid;
  DELETE FROM rotation_rules WHERE station_id=sid;
  DELETE FROM stream_mounts WHERE station_id=sid;
  DELETE FROM live_inputs WHERE station_id=sid;
  DELETE FROM icecast_configs WHERE station_id=sid;
  DELETE FROM liquidsoap_configs WHERE station_id=sid;
  DELETE FROM media_files WHERE station_id=sid;
  DELETE FROM stations WHERE id=sid;
END;
$$;