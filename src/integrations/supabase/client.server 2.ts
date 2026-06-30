/**
 * Supabase admin client stub — Supabase har tagits bort.
 *
 * Exporterar `supabaseAdmin` med samma sökväg och typ som tidigare så att
 * befintliga server-filer kompilerar och returnerar säkra tomma svar.
 *
 * Fullständigt chainbar query-builder: from().select().eq().maybeSingle() osv.
 * insert/update/upsert/delete är alla chainbara (returnerar stubb, awaitable).
 *
 * TODO: migrera resterande konsumenter till Drizzle.
 */

// ─── Chainbar query-stub ─────────────────────────────────────────────────────

function makeQueryBuilder(multi = false): any {
  const emptyResult = multi ? { data: [], error: null } : { data: null, error: null };
  const stub: any = {
    select:     () => stub,
    insert:     (_vals?: any) => stub,   // chainbar: .insert({}).select().single()
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
    // Terminal resolvers
    then:         (resolve: (v: any) => any) => Promise.resolve(emptyResult).then(resolve),
    catch:        (reject: (v: any) => any) => Promise.resolve(emptyResult).catch(reject),
    finally:      (fn: () => any) => Promise.resolve(emptyResult).finally(fn),
    maybeSingle:  () => Promise.resolve({ data: null, error: null }),
    single:       () => Promise.resolve({ data: null, error: null }),
  };
  return stub;
}

// ─── Auth stub (server-side) ─────────────────────────────────────────────────

const authStub = {
  getUser: async (_token?: string): Promise<{ data: { user: { id: string } | null }; error: null }> => ({
    data: { user: null },
    error: null,
  }),
};

// ─── Primär export ───────────────────────────────────────────────────────────

// Import: import { supabaseAdmin } from "@/integrations/supabase/client.server";
export const supabaseAdmin = {
  auth: authStub,
  from: (_table: string) => makeQueryBuilder(true),
  rpc: (_fn: string, _params?: unknown) => makeQueryBuilder(false),
};
