type ClientEnvironment = {
  apiUrl: string;
  supabaseUrl: string;
  supabaseAnonKey: string;
  enableLocalAuth: boolean;
};

function read(name: keyof ImportMetaEnv): string {
  const value = import.meta.env[name];
  return typeof value === "string" ? value.trim() : "";
}

const apiUrl = read("VITE_API_URL").replace(/\/$/, "");
const supabaseUrl = read("VITE_SUPABASE_URL") || read("NEXT_PUBLIC_RC_SUPABASE_SUPABASE_URL");
const supabaseAnonKey =
  read("VITE_SUPABASE_ANON_KEY") ||
  read("VITE_SUPABASE_PUBLISHABLE_KEY") ||
  read("NEXT_PUBLIC_RC_SUPABASE_SUPABASE_PUBLISHABLE_KEY");

export const env: Readonly<ClientEnvironment> = Object.freeze({
  apiUrl,
  supabaseUrl,
  supabaseAnonKey,
  enableLocalAuth: read("VITE_ENABLE_LOCAL_AUTH").toLowerCase() === "true",
});

export const SUPABASE_ENABLED = Boolean(env.supabaseUrl && env.supabaseAnonKey);
export const LOCAL_AUTH_ENABLED = env.enableLocalAuth;

// The Radio Core API now runs in-process (TanStack Start server routes under
// /api/v1/*, same Vercel deployment). VITE_API_URL is only needed when
// pointing at a separate, externally hosted API gateway — leave it unset to
// use same-origin relative requests.
if (import.meta.env.DEV) {
  if (Boolean(env.supabaseUrl) !== Boolean(env.supabaseAnonKey)) {
    console.warn(
      "[radio-core] Supabase is disabled because both URL and anon/publishable key are required.",
    );
  }
  if (!SUPABASE_ENABLED) console.warn("[radio-core] Supabase legacy integration is disabled.");
}
