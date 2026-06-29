import { createClient } from "@supabase/supabase-js";
import { createMiddleware } from "@tanstack/react-start";
import { getRequest } from "@tanstack/react-start/server";
import type { Database } from "@/integrations/supabase/types";

export const requireSupabaseAuth = createMiddleware({ type: "function" }).server(
  async ({ next }) => {
    const url = process.env.SUPABASE_URL;
    const anonKey = process.env.SUPABASE_ANON_KEY ?? process.env.SUPABASE_PUBLISHABLE_KEY;
    if (!url || !anonKey) {
      throw new Response("Supabase server authentication is not configured", { status: 500 });
    }

    const authorization = getRequest().headers.get("authorization");
    if (!authorization?.startsWith("Bearer ")) {
      throw new Response("Unauthorized: Bearer token required", { status: 401 });
    }
    const token = authorization.slice("Bearer ".length).trim();
    const userDatabase = createClient<Database>(url, anonKey, {
      global: { headers: { Authorization: `Bearer ${token}` } },
      auth: { storage: undefined, persistSession: false, autoRefreshToken: false },
    });
    const { data, error } = await userDatabase.auth.getClaims(token);
    if (error || !data?.claims?.sub) {
      throw new Response("Unauthorized: Invalid token", { status: 401 });
    }

    return next({
      context: { supabase: userDatabase, userId: data.claims.sub, claims: data.claims },
    });
  },
);
