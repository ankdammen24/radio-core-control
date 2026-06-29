/** @deprecated Use the provider-neutral database service. */
export { database as supabase } from "@/services/database/client";
export type { Session as AuthSession, User as AuthUser } from "@supabase/supabase-js";
