import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";

function createAdminDatabase() {
  const url = process.env.SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceRoleKey) {
    throw new Error("Supabase server access requires SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY.");
  }
  return createClient<Database>(url, serviceRoleKey, {
    auth: { storage: undefined, persistSession: false, autoRefreshToken: false },
  });
}

let instance: ReturnType<typeof createAdminDatabase> | undefined;

/** Server-only provider. Never import this module into browser components. */
export const adminDatabase = new Proxy({} as ReturnType<typeof createAdminDatabase>, {
  get(_target, property) {
    instance ??= createAdminDatabase();
    const value = Reflect.get(instance, property, instance);
    return typeof value === "function" ? value.bind(instance) : value;
  },
});
