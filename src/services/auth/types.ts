export interface AuthUser {
  id: string;
  email?: string | null;
  user_metadata?: Record<string, unknown>;
}

export interface AuthSession {
  access_token: string;
  user: AuthUser;
  expires_at?: number;
}

export type AppRole = "admin" | "editor" | "viewer";
export type SocialProvider = "google" | "apple";
export type AuthMode = "supabase" | "local" | "guest";

export interface AuthService {
  getSession(): Promise<AuthSession | null>;
  onSessionChanged(callback: (session: AuthSession | null) => void): () => void;
  signInWithPassword(email: string, password: string): Promise<void>;
  signUp(email: string, password: string, displayName?: string): Promise<void>;
  signInWithOAuth(provider: SocialProvider): Promise<void>;
  signInWithSSO(domain: string): Promise<string | null>;
  signOut(): Promise<void>;
}
