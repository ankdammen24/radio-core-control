# Storage Targets — Radio Uppsala defaults

Seed examples for Radio Uppsala. Insert via the Storage Targets UI
(`/storage-targets`) once the station exists. Credentials are referenced
by env-var name; raw secrets are never stored in the database.

Required env vars (already set in this project):
- `S3_ENDPOINT`              — Cloudflare R2 endpoint
- `S3_ACCESS_KEY_ID`         — R2 access key
- `S3_SECRET_ACCESS_KEY`     — R2 secret key
- `S3_BUCKET_MEDIA` / `S3_BUCKET_PUBLIC` / `S3_BUCKET_ARTWORK`
- `MEDIA_PUBLIC_URL` / `PUBLIC_CDN_URL` / `ARTWORK_PUBLIC_URL`

## Targets

1. **Radio Uppsala Media**
   - provider: `r2`
   - purpose:  `media`
   - bucket:   `radio-core-media` (`$S3_BUCKET_MEDIA`)
   - endpoint_url:    `$S3_ENDPOINT`
   - region:          `auto`
   - public_base_url: `https://media.radiouppsala.se`
   - access_key_ref:  `S3_ACCESS_KEY_ID`
   - secret_key_ref:  `S3_SECRET_ACCESS_KEY`

2. **Radio Uppsala CDN**
   - provider: `r2`
   - purpose:  `cdn`
   - bucket:   `radio-core-public` (`$S3_BUCKET_PUBLIC`)
   - endpoint_url:    `$S3_ENDPOINT`
   - region:          `auto`
   - public_base_url: `https://cdn.radiouppsala.se`
   - access_key_ref:  `S3_ACCESS_KEY_ID`
   - secret_key_ref:  `S3_SECRET_ACCESS_KEY`

3. **Radio Uppsala Images**
   - provider: `r2`
   - purpose:  `artwork`
   - bucket:   `radio-core-artwork` (`$S3_BUCKET_ARTWORK`)
   - endpoint_url:    `$S3_ENDPOINT`
   - region:          `auto`
   - public_base_url: `https://img.radiouppsala.se`
   - access_key_ref:  `S3_ACCESS_KEY_ID`
   - secret_key_ref:  `S3_SECRET_ACCESS_KEY`

Use **Test connection** on each target to verify bucket access and the
public URL. Each test inserts a row into `storage_health_checks`,
mirrors a `storage_check` entry into `sync_jobs`, and updates the
target's `status` / `last_checked_at` / `last_error`.
