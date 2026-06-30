import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";

const WRITE_METHODS = new Set(["insert", "update", "upsert", "delete"]);

export class SupabaseDisabledError extends Error {
  readonly code = "SUPABASE_DISABLED";
  readonly details = "The optional Supabase legacy integration is not configured.";
  readonly hint = "Use Radio Core Backend or configure VITE_SUPABASE_URL and its key.";

  constructor() {
    super("Supabase integration is disabled");
    this.name = "SupabaseDisabledError";
  }
}

function disabledQuery(data: unknown = [], write = false): unknown {
  const result = {
    data,
    error: write ? new SupabaseDisabledError() : null,
    count: 0,
    status: write ? 503 : 200,
    statusText: write ? "Supabase disabled" : "Supabase disabled; empty result",
  };
  const promise = Promise.resolve(result);

  return new Proxy(() => undefined, {
    get(_target, property) {
      if (property === "then") return promise.then.bind(promise);
      if (property === "catch") return promise.catch.bind(promise);
      if (property === "finally") return promise.finally.bind(promise);

      return (..._args: unknown[]) => {
        const method = String(property);
        const nextData = method === "single" || method === "maybeSingle" ? null : data;
        return disabledQuery(nextData, write || WRITE_METHODS.has(method));
      };
    },
  });
}

function disabledStorageBucket() {
  const read = async () => ({ data: [], error: null });
  const write = async () => ({ data: null, error: new SupabaseDisabledError() });
  return {
    list: read,
    download: write,
    upload: write,
    update: write,
    move: write,
    copy: write,
    remove: write,
    createSignedUrl: write,
    createSignedUrls: write,
    getPublicUrl: () => ({ data: { publicUrl: "" } }),
  };
}

/**
 * Compatibility wrapper for legacy modules. It never creates a Supabase
 * client, returns empty data for reads, and rejects writes explicitly.
 */
export function createDisabledSupabaseClient(): SupabaseClient<Database> {
  const channel = {
    on: () => channel,
    subscribe: () => channel,
    unsubscribe: async () => "ok",
  };
  const client = {
    from: () => disabledQuery(),
    rpc: () => disabledQuery(null),
    auth: {
      getSession: async () => ({ data: { session: null }, error: null }),
      getUser: async () => ({ data: { user: null }, error: null }),
      getClaims: async () => ({ data: null, error: new SupabaseDisabledError() }),
      onAuthStateChange: () => ({
        data: { subscription: { id: "disabled", callback: () => undefined, unsubscribe() {} } },
      }),
      signInWithPassword: async () => ({
        data: { user: null, session: null },
        error: new SupabaseDisabledError(),
      }),
      signUp: async () => ({
        data: { user: null, session: null },
        error: new SupabaseDisabledError(),
      }),
      signInWithOAuth: async () => ({
        data: { provider: null, url: null },
        error: new SupabaseDisabledError(),
      }),
      signInWithSSO: async () => ({ data: null, error: new SupabaseDisabledError() }),
      signOut: async () => ({ error: null }),
    },
    storage: { from: () => disabledStorageBucket() },
    functions: {
      invoke: async () => ({ data: null, error: new SupabaseDisabledError() }),
    },
    channel: () => channel,
    removeChannel: async () => "ok",
    removeAllChannels: async () => [],
    getChannels: () => [],
  };

  return client as unknown as SupabaseClient<Database>;
}
