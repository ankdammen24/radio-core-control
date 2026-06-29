/**
 * Audit log helper
 *
 * TODO: migrera till Drizzle — skriver till audit_logs via db.insert(auditLogs)
 * Tills vidare: no-op stub (audit logs skrivs direkt från server-routes).
 */
export async function logAudit(
  _action: string,
  _entity_type?: string,
  _entity_id?: string,
  _payload?: Record<string, unknown>,
): Promise<void> {
  // TODO: implement via Drizzle
  // import { db } from "@/server/db/client";
  // import { auditLogs } from "@/server/db/schema";
  // await db.insert(auditLogs).values({ action, entityType, entityId, newValue: payload });
}
