import { database } from "./client";

export async function checkDatabaseHealth() {
  const startedAt = Date.now();
  const { error } = await database.from("stations").select("id", { head: true, count: "exact" });
  return {
    configured: true,
    reachable: !error,
    latencyMs: Date.now() - startedAt,
    message: error?.message ?? "Supabase is available",
  };
}
