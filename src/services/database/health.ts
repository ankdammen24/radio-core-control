import { database, SUPABASE_ENABLED } from "./client";

export async function checkDatabaseHealth() {
  if (!SUPABASE_ENABLED) {
    return {
      configured: false,
      reachable: false,
      latencyMs: 0,
      message: "Supabase legacy integration is disabled",
    };
  }
  const startedAt = Date.now();
  const { error } = await database.from("stations").select("id", { head: true, count: "exact" });
  return {
    configured: true,
    reachable: !error,
    latencyMs: Date.now() - startedAt,
    message: error?.message ?? "Supabase is available",
  };
}
