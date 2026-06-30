# Bootstrap a new Radio Core installation

An empty MongoDB database is a supported starting state. API startup creates
collections and indexes, but it does not create stations, media, or public
configuration automatically.

## 1. Start the backend

Configure `MONGODB_URL` for the API container and start Radio Core normally.
These endpoints should work with an empty database:

```text
GET /health
GET /api/health
GET /api/stations          -> data: []
GET /api/media/status      -> zero counts
GET /api/config/public     -> empty/not-found response handled by frontend
```

## 2. Optional Radio Uppsala seed

Run this only when the first station should be created:

```bash
cd backend/api
npm run bootstrap:radio-uppsala
```

The idempotent script creates:

```text
name: Radio Uppsala
slug: radio-uppsala
domain: radiouppsala.se
apiDomain: api.radiouppsala.se
status: active
```

Set `RADIO_UPPSALA_STATION_ID` to require a stable external ID. Otherwise the
script generates an ID on first insert and reuses the station by slug on later
runs.

## 3. Choose authentication mode

- No provider: read-only guest mode.
- `VITE_ENABLE_LOCAL_AUTH=true`: explicit local administrator bootstrap.
- Supabase values present: legacy Supabase login.

Disable local auth after a durable production login provider has been enabled.
