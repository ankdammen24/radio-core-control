-- Add fields needed for the runner/agent heartbeat endpoint (Fas 3).
-- Non-destructive: all changes use ADD COLUMN IF NOT EXISTS / ALTER COLUMN … SET DEFAULT.

-- metrics: jsonb blob reported by the runner on each heartbeat (cpu, memory_mb, disk_free_mb, …)
ALTER TABLE public.agent_instances
  ADD COLUMN IF NOT EXISTS metrics jsonb NOT NULL DEFAULT '{}';

-- reload_requested_at: set by an admin action in the UI; cleared by the agent on next heartbeat.
-- When non-null the heartbeat response includes reload_requested: true so the runner re-fetches config.
ALTER TABLE public.agent_instances
  ADD COLUMN IF NOT EXISTS reload_requested_at timestamptz NULL;

COMMENT ON COLUMN public.agent_instances.metrics IS
  'Runtime metrics reported by the agent on each heartbeat (cpu, memory_mb, disk_free_mb).';

COMMENT ON COLUMN public.agent_instances.reload_requested_at IS
  'Set by an admin to request a config reload. Cleared by the agent on the next heartbeat that acknowledges it.';
