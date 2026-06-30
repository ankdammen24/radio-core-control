import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { env, SUPABASE_ENABLED } from "@/config/env";
import type { Database } from "@/integrations/supabase/types";
import { createDisabledSupabaseClient } from "./disabled-client";

export const supabaseClient: SupabaseClient<Database> | null = SUPABASE_ENABLED
  ? createClient<Database>(env.supabaseUrl, env.supabaseAnonKey, {
      auth: {
        storage: typeof window === "undefined" ? undefined : window.localStorage,
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true,
      },
    })
  : null;

/** Null-safe compatibility surface for legacy modules during migration. */
export const database = supabaseClient ?? createDisabledSupabaseClient();

export { SUPABASE_ENABLED };
