import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";

function createBrowserDatabase() {
  const url = import.meta.env.VITE_SUPABASE_URL?.trim();
  const key =
    import.meta.env.VITE_SUPABASE_ANON_KEY?.trim() ||
    import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY?.trim();

  if (!url || !key) {
    throw new Error(
      "Supabase is not configured. Set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY in Vercel.",
    );
  }

  return createClient<Database>(url, key, {
    auth: {
      storage: typeof window === "undefined" ? undefined : window.localStorage,
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true,
    },
  });
}

let instance: ReturnType<typeof createBrowserDatabase> | undefined;

/** Temporary database provider; domain services can be migrated independently. */
export const database = new Proxy({} as ReturnType<typeof createBrowserDatabase>, {
  get(_target, property) {
    instance ??= createBrowserDatabase();
    const value = Reflect.get(instance, property, instance);
    return typeof value === "function" ? value.bind(instance) : value;
  },
});
