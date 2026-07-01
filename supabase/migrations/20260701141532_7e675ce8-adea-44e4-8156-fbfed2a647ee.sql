ALTER TABLE public.agent_instances ADD COLUMN IF NOT EXISTS reload_requested_at TIMESTAMPTZ;
ALTER TABLE public.stack_tokens ADD COLUMN IF NOT EXISTS revoked_at TIMESTAMPTZ;