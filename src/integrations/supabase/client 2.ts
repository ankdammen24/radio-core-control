/**
 * Supabase client stub — Supabase har tagits bort.
 *
 * Behåller samma import-sökväg so att befintliga UI-filer kompilerar och
 * returnerar säkra tomma svar tills varje fil migreras till Drizzle-repos.
 *
 * TODO:
 *   - supabase.from(table) → TanStack server functions + Drizzle repos
 *   - supabase.auth.*      → lokal auth (JWT / sessions-tabell)
 */

// ─── Lokala typer (ersätter @supabase/supabase-js-typer) ─────────────────────

export interface AuthUser {
  id: string;
  email?: string;
  user_metadata?: Record<string, unknown>;
}

export interface AuthSession {
  access_token: string;
  user: AuthUser;
}

// ─── Chainbar query-stub ──────────────────────────────────────────────────────

function makeQueryBuilder(multi = false): any {
  const emptyResult = multi ? { data: [], error: null } : { data: null, error: null };
  const stub: any = {
    select:     () => stub,
    insert:     (_vals?: any) => stub,
    update:     (_vals?: any) => stub,
    upsert:     (_vals?: any) => stub,
    delete:     () => stub,
    eq:         () => stub,
    neq:        () => stub,
    gt:         () => stub,
    lt:         () => stub,
    gte:        () => stub,
    lte:        () => stub,
    like:       () => stub,
    ilike:      () => stub,
    in:         () => stub,
    is:         () => stub,
    order:      () => stub,
    limit:      () => stub,
    range:      () => stub,
    filter:     () => stub,
    match:      () => stub,
    not:        () => stub,
    or:         () => stub,
    then:         (resolve: (v: any) => any) => Promise.resolve(emptyResult).then(resolve),
    catch:        (reject: (v: any) => any) => Promise.resolve(emptyResult).catch(reject),
    finally:      (fn: () => any) => Promise.resolve(emptyResult).finally(fn),
    maybeSingle:  () => Promise.resolve({ data: null, error: null }),
    single:       () => Promise.resolve({ data: null, error: null }),
  };
  return stub;
}

// ─── Auth stub ────────────────────────────────────────────────────────────────

const authStub = {
  getSession: async () => ({ data: { session: null as AuthSession | null } }),
  getUser: async () => ({ data: { user: null as AuthUser | null }, error: null }),
  onAuthStateChange: (_cb: (event: string, session: AuthSession | null) => void) =>
    ({ data: { subscription: { unsubscribe: () => {} } } }),
  signInWithPassword: async (_opts: { email: string; password: string }) => ({
    data: null,
    error: new Error("Auth ej implementerad — anslut till lokal auth-provider."),
  }),
  signUp: async (_opts: unknown) => ({
    data: null,
    error: new Error("Auth ej implementerad — anslut till lokal auth-provider."),
  }),
  signInWithOAuth: async (_opts: unknown) => ({
    data: null,
    error: new Error("OAuth ej implementerad — anslut till lokal auth-provider."),
  }),
  signInWithSSO: async (_opts: unknown): Promise<{ data: { url?: string } | null; error: Error | null }> => ({
    data: null,
    error: new Error("SSO ej implementerad."),
  }),
  signOut: async () => ({ error: null }),
  updateUser: async (_opts: unknown) => ({
    data: null,
    error: new Error("updateUser ej implementerad."),
  }),
  getClaims: async (_token: string): Promise<{ data: { claims: Record<string, unknown> } | null; error: Error | null }> => ({
    data: null,
    error: new Error("getClaims ej implementerad i stub"),
  }),
};

// ─── Primär export ────────────────────────────────────────────────────────────

// Import: import { supabase } from "@/integrations/supabase/client";
export const supabase = {
  auth: authStub,
  from: (_table: string) => makeQueryBuilder(true),
  rpc: (_fn: string, _params?: unknown) => makeQueryBuilder(false),
  storage: {
    from: (_bucket: string) => ({
      upload: async () => ({ data: null, error: new Error("Storage stub") }),
      download: async () => ({ data: null, error: new Error("Storage stub") }),
      getPublicUrl: (_path: string) => ({ data: { publicUrl: "" } }),
      remove: async () => ({ data: null, error: null }),
      list: async () => ({ data: [], error: null }),
    }),
  },
  // Realtime stub — channel/removeChannel används av audit.tsx och liknande
  channel: (_name: string) => {
    const ch: any = {
      on: () => ch,
      subscribe: () => ch,
      unsubscribe: async () => {},
    };
    return ch;
  },
  removeChannel: async (_ch: unknown) => {},
  // Edge Functions stub
  functions: {
    invoke: async (_name: string, _opts?: unknown) => ({ data: null, error: null }),
  },
};
