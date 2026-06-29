-- Add revoked_at to stack_tokens
-- Non-destructive: adds a nullable column; no existing rows are affected.
-- When a token is revoked: is_active = false AND revoked_at = now().
-- Tokens with is_active = false AND revoked_at IS NULL are legacy-disabled (pre-migration).

ALTER TABLE public.stack_tokens
  ADD COLUMN IF NOT EXISTS revoked_at timestamptz NULL;

COMMENT ON COLUMN public.stack_tokens.revoked_at IS
  'Set when a token is explicitly revoked. NULL means the token has not been revoked (may still be inactive via is_active).';
