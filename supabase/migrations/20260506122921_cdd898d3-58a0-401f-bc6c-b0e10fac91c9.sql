
-- ============ Tighten admin-only policies ============

-- system_settings: admin only for writes
DROP POLICY IF EXISTS system_settings_insert_editor ON public.system_settings;
DROP POLICY IF EXISTS system_settings_update_editor ON public.system_settings;
CREATE POLICY system_settings_insert_admin ON public.system_settings
  FOR INSERT TO authenticated WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE POLICY system_settings_update_admin ON public.system_settings
  FOR UPDATE TO authenticated USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- azuracast_connections: admin only for writes (integrations)
DROP POLICY IF EXISTS azuracast_connections_insert_editor ON public.azuracast_connections;
DROP POLICY IF EXISTS azuracast_connections_update_editor ON public.azuracast_connections;
CREATE POLICY azuracast_connections_insert_admin ON public.azuracast_connections
  FOR INSERT TO authenticated WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE POLICY azuracast_connections_update_admin ON public.azuracast_connections
  FOR UPDATE TO authenticated USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- roles: admin only for writes
DROP POLICY IF EXISTS roles_insert_editor ON public.roles;
DROP POLICY IF EXISTS roles_update_editor ON public.roles;
CREATE POLICY roles_insert_admin ON public.roles
  FOR INSERT TO authenticated WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE POLICY roles_update_admin ON public.roles
  FOR UPDATE TO authenticated USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- ============ Generic audit trigger ============
CREATE OR REPLACE FUNCTION public.audit_trigger()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_entity_id uuid;
  v_old jsonb;
  v_new jsonb;
BEGIN
  IF TG_OP = 'DELETE' THEN
    v_old := to_jsonb(OLD);
    v_entity_id := (OLD).id;
  ELSIF TG_OP = 'UPDATE' THEN
    v_old := to_jsonb(OLD);
    v_new := to_jsonb(NEW);
    v_entity_id := (NEW).id;
  ELSE
    v_new := to_jsonb(NEW);
    v_entity_id := (NEW).id;
  END IF;

  INSERT INTO public.audit_logs (user_id, action, entity_type, entity_id, old_value, new_value)
  VALUES (auth.uid(), lower(TG_OP), TG_TABLE_NAME, v_entity_id, v_old, v_new);

  RETURN COALESCE(NEW, OLD);
END;
$$;

-- Attach audit triggers to key tables
DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'stations','accounts','playlists','schedule_blocks','rotation_rules',
    'azuracast_connections','system_settings','storage_locations',
    'track_metadata','media_files','playlist_assignments','user_roles'
  ]
  LOOP
    EXECUTE format('DROP TRIGGER IF EXISTS audit_%I ON public.%I', t, t);
    EXECUTE format('CREATE TRIGGER audit_%I AFTER INSERT OR UPDATE OR DELETE ON public.%I FOR EACH ROW EXECUTE FUNCTION public.audit_trigger()', t, t);
  END LOOP;
END $$;

-- ============ Validation triggers ============

-- Station slug: lowercase letters, digits, hyphens
CREATE OR REPLACE FUNCTION public.validate_station()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF NEW.slug !~ '^[a-z0-9]([a-z0-9-]*[a-z0-9])?$' THEN
    RAISE EXCEPTION 'Invalid slug %, must be lowercase letters, digits and hyphens', NEW.slug;
  END IF;
  IF length(NEW.name) < 2 OR length(NEW.name) > 120 THEN
    RAISE EXCEPTION 'Station name must be 2–120 characters';
  END IF;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS validate_stations ON public.stations;
CREATE TRIGGER validate_stations BEFORE INSERT OR UPDATE ON public.stations
  FOR EACH ROW EXECUTE FUNCTION public.validate_station();

-- Account email format
CREATE OR REPLACE FUNCTION public.validate_account()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF NEW.contact_email IS NOT NULL AND NEW.contact_email <> ''
     AND NEW.contact_email !~* '^[A-Z0-9._%%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}$' THEN
    RAISE EXCEPTION 'Invalid contact email %', NEW.contact_email;
  END IF;
  IF length(NEW.name) < 2 THEN RAISE EXCEPTION 'Account name too short'; END IF;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS validate_accounts ON public.accounts;
CREATE TRIGGER validate_accounts BEFORE INSERT OR UPDATE ON public.accounts
  FOR EACH ROW EXECUTE FUNCTION public.validate_account();

-- Schedule block: end > start
CREATE OR REPLACE FUNCTION public.validate_schedule_block()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF NEW.end_time <= NEW.start_time THEN
    RAISE EXCEPTION 'End time must be after start time';
  END IF;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS validate_schedule_blocks ON public.schedule_blocks;
CREATE TRIGGER validate_schedule_blocks BEFORE INSERT OR UPDATE ON public.schedule_blocks
  FOR EACH ROW EXECUTE FUNCTION public.validate_schedule_block();

-- Rotation rule sanity
CREATE OR REPLACE FUNCTION public.validate_rotation_rule()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF NEW.min_minutes_between_same_artist < 0
     OR NEW.min_minutes_between_same_track < 0
     OR NEW.max_tracks_per_hour < 1 OR NEW.max_tracks_per_hour > 60
     OR NEW.priority < 0 OR NEW.priority > 100 THEN
    RAISE EXCEPTION 'Rotation rule values out of range';
  END IF;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS validate_rotation_rules ON public.rotation_rules;
CREATE TRIGGER validate_rotation_rules BEFORE INSERT OR UPDATE ON public.rotation_rules
  FOR EACH ROW EXECUTE FUNCTION public.validate_rotation_rule();
