/**
 * Auth context — Supabase Auth har tagits bort.
 *
 * Tillfällig stub: returnerar en inloggad dev-användare i development
 * (import.meta.env.DEV = true). Ingen session i produktion förrän riktig
 * auth är implementerad.
 *
 * TODO: implementera riktig auth:
 *   1. POST /api/auth/signin → JWT + session i sessions-tabellen
 *   2. Verifiera JWT mot AUTH_SECRET vid varje request
 *   3. Hämta roller från users/user_roles via Drizzle
 */
import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import type { AuthSession, AuthUser } from "@/integrations/supabase/client";

type Role = "admin" | "editor" | "viewer";

interface AuthState {
  session: AuthSession | null;
  user: AuthUser | null;
  roles: Role[];
  loading: boolean;
  signOut: () => Promise<void>;
  isAdmin: boolean;
  isEditor: boolean;
}

const LOCAL_SESSION_KEY = "rc.session_token";
const LOCAL_USER_KEY = "rc.user";

const AuthCtx = createContext<AuthState>({
  session: null,
  user: null,
  roles: [],
  loading: false,
  signOut: async () => {},
  isAdmin: false,
  isEditor: false,
});

function getStoredSession(): AuthSession | null {
  if (typeof window === "undefined") return null;
  const raw = window.localStorage.getItem(LOCAL_USER_KEY);
  if (!raw) return null;
  try {
    const user = JSON.parse(raw) as AuthUser;
    const token = window.localStorage.getItem(LOCAL_SESSION_KEY) ?? "";
    return token ? { access_token: token, user } : null;
  } catch {
    return null;
  }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<AuthSession | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // TODO: verifiera token mot backend vid startup
    if (import.meta.env.DEV) {
      // Dev stub — alltid inloggad som admin
      setSession({ access_token: "dev-token", user: { id: "dev-user", email: "dev@radio-core.local" } });
    } else {
      setSession(getStoredSession());
    }
    setLoading(false);
  }, []);

  // TODO: hämta riktiga roller från API/Drizzle
  const roles: Role[] = session ? ["admin"] : [];

  const signOut = async () => {
    if (typeof window !== "undefined") {
      window.localStorage.removeItem(LOCAL_SESSION_KEY);
      window.localStorage.removeItem(LOCAL_USER_KEY);
    }
    setSession(null);
  };

  const value: AuthState = {
    session,
    user: session?.user ?? null,
    roles,
    loading,
    signOut,
    isAdmin: roles.includes("admin"),
    isEditor: roles.includes("admin") || roles.includes("editor"),
  };

  return <AuthCtx.Provider value={value}>{children}</AuthCtx.Provider>;
}

export const useAuth = () => useContext(AuthCtx);
