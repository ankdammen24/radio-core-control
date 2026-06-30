type ClientEnvironment = {
  apiUrl: string;
  supabaseUrl: string;
  supabaseAnonKey: string;
  auth0Domain: string;
  auth0ClientId: string;
  auth0Audience: string;
  auth0CallbackUrl: string;
  auth0LogoutUrl: string;
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
  auth0Domain: read("VITE_AUTH0_DOMAIN"),
  auth0ClientId: read("VITE_AUTH0_CLIENT_ID"),
  auth0Audience: read("VITE_AUTH0_AUDIENCE"),
  auth0CallbackUrl: read("VITE_AUTH0_CALLBACK_URL"),
  auth0LogoutUrl: read("VITE_AUTH0_LOGOUT_URL"),
  enableLocalAuth: read("VITE_ENABLE_LOCAL_AUTH").toLowerCase() === "true",
});

export const SUPABASE_ENABLED = Boolean(env.supabaseUrl && env.supabaseAnonKey);
export const AUTH0_ENABLED = Boolean(env.auth0Domain && env.auth0ClientId);
export const LOCAL_AUTH_ENABLED = env.enableLocalAuth;

if (!env.apiUrl) {
  throw new Error("VITE_API_URL is required. Set it to the Radio Core API gateway URL.");
}

if (import.meta.env.DEV) {
  if (Boolean(env.supabaseUrl) !== Boolean(env.supabaseAnonKey)) {
    console.warn(
      "[radio-core] Supabase is disabled because both URL and anon/publishable key are required.",
    );
  }
  if (Boolean(env.auth0Domain) !== Boolean(env.auth0ClientId)) {
    console.warn("[radio-core] Auth0 is disabled because both domain and client ID are required.");
  }
  if (!SUPABASE_ENABLED) console.warn("[radio-core] Supabase legacy integration is disabled.");
  if (!AUTH0_ENABLED) console.warn("[radio-core] Auth0 legacy integration is disabled.");
}
