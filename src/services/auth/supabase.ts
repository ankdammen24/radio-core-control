import { supabaseClient } from "@/services/database";
import type { AuthService } from "./types";

function client() {
  if (!supabaseClient) throw new Error("Supabase login is not configured");
  return supabaseClient;
}

function throwIfError(error: { message: string } | null) {
  if (error) throw new Error(error.message);
}

export const supabaseAuthService: AuthService = {
  async getSession() {
    const { data, error } = await client().auth.getSession();
    throwIfError(error);
    return data.session;
  },
  onSessionChanged(callback) {
    const { data } = client().auth.onAuthStateChange((_event, session) => callback(session));
    return () => data.subscription.unsubscribe();
  },
  async signInWithPassword(email, password) {
    const { error } = await client().auth.signInWithPassword({ email, password });
    throwIfError(error);
  },
  async signUp(email, password, displayName) {
    const { error } = await client().auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: window.location.origin,
        data: displayName ? { display_name: displayName } : undefined,
      },
    });
    throwIfError(error);
  },
  async signInWithOAuth(provider) {
    const { error } = await client().auth.signInWithOAuth({
      provider,
      options: { redirectTo: window.location.origin },
    });
    throwIfError(error);
  },
  async signInWithSSO(domain) {
    const { data, error } = await client().auth.signInWithSSO({
      domain,
      options: { redirectTo: window.location.origin },
    });
    throwIfError(error);
    return data?.url ?? null;
  },
  async signOut() {
    const { error } = await client().auth.signOut();
    throwIfError(error);
  },
};
