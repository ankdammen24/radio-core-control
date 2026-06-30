import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";
import { createDisabledSupabaseClient } from "@/lib/supabase/disabled-client";

const url = process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_RC_SUPABASE_SUPABASE_URL;
const serviceRoleKey =
  process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.RC_SUPABASE_SUPABASE_SERVICE_ROLE_KEY;

export const serverSupabaseEnabled = Boolean(url && serviceRoleKey);

export const adminDatabaseClient: SupabaseClient<Database> | null =
  url && serviceRoleKey
    ? createClient<Database>(url, serviceRoleKey, {
        auth: { storage: undefined, persistSession: false, autoRefreshToken: false },
      })
    : null;

/** Null-safe server compatibility surface for legacy routes. */
export const adminDatabase = adminDatabaseClient ?? createDisabledSupabaseClient();
