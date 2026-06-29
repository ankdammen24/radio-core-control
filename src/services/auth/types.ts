import type { Session, User } from "@supabase/supabase-js";

export type AuthSession = Session;
export type AuthUser = User;
export type AppRole = "admin" | "editor" | "viewer";
export type SocialProvider = "google" | "apple";

export interface AuthService {
  getSession(): Promise<AuthSession | null>;
  onSessionChanged(callback: (session: AuthSession | null) => void): () => void;
  signInWithPassword(email: string, password: string): Promise<void>;
  signUp(email: string, password: string, displayName?: string): Promise<void>;
  signInWithOAuth(provider: SocialProvider): Promise<void>;
  signInWithSSO(domain: string): Promise<string | null>;
  signOut(): Promise<void>;
}
