-- Stable fallback records shared with the MongoDB seed.
-- Keep the station UUID aligned with RADIO_UPPSALA_STATION_ID in infra/.env.

INSERT INTO public.accounts (id, name, type, contact_email, notes)
VALUES (
  'f33b9cc3-8067-4a9e-a39d-45308b1b2499',
  'Radio Uppsala',
  'station_owner',
  'info@radiouppsala.se',
  'Default account created by the Radio Core fallback seed.'
)
ON CONFLICT (id) DO UPDATE SET
  name = EXCLUDED.name,
  type = EXCLUDED.type,
  contact_email = EXCLUDED.contact_email,
  updated_at = now();

INSERT INTO public.stations (id, account_id, name, slug, description, is_active)
VALUES (
  '7b5fd114-b188-4d8d-9210-3e924c68efc7',
  'f33b9cc3-8067-4a9e-a39d-45308b1b2499',
  'Radio Uppsala',
  'radio-uppsala',
  'Lokal radio från Uppsala.',
  true
)
ON CONFLICT (id) DO UPDATE SET
  account_id = EXCLUDED.account_id,
  name = EXCLUDED.name,
  slug = EXCLUDED.slug,
  description = EXCLUDED.description,
  is_active = EXCLUDED.is_active,
  updated_at = now();

INSERT INTO public.system_settings (key, value, description)
VALUES (
  'public',
  '{
    "product_name": "Radio Core",
    "default_station_slug": "radio-uppsala",
    "public_site_url": "https://radiouppsala.se",
    "listen_url": "https://listen.radiouppsala.se",
    "support_email": "info@radiouppsala.se",
    "features": {
      "podcasts": true,
      "requests": true,
      "public_player": true
    }
  }'::jsonb,
  'Public, read-only frontend configuration used during the staged migration.'
)
ON CONFLICT (key) DO UPDATE SET
  value = EXCLUDED.value,
  description = EXCLUDED.description,
  updated_at = now();
