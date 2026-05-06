import { supabase } from "@/integrations/supabase/client";

/**
 * Manual audit log for application-level actions (e.g., "tested AzuraCast connection",
 * "queued sync job"). Database mutations are already audited automatically by triggers.
 */
export async function logAudit(action: string, entity_type?: string, entity_id?: string, payload?: Record<string, unknown>) {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return;
  await supabase.from("audit_logs").insert({
    user_id: user.id,
    action,
    entity_type: entity_type ?? null,
    entity_id: entity_id ?? null,
    new_value: payload ?? null,
  });
}
