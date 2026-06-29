import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import {
  authService,
  type AppRole,
  type AuthSession,
  type AuthUser,
  type SocialProvider,
} from "@/services/auth";
import { database } from "@/services/database";

interface AuthState {
  session: AuthSession | null;
  user: AuthUser | null;
  roles: AppRole[];
  loading: boolean;
  signInWithPassword: (email: string, password: string) => Promise<void>;
  signUp: (email: string, password: string, displayName?: string) => Promise<void>;
  signInWithOAuth: (provider: SocialProvider) => Promise<void>;
  signInWithSSO: (domain: string) => Promise<string | null>;
  signOut: () => Promise<void>;
  isAdmin: boolean;
  isEditor: boolean;
}

const AuthCtx = createContext<AuthState | null>(null);

async function loadRoles(userId: string): Promise<AppRole[]> {
  const { data, error } = await database.from("user_roles").select("role").eq("user_id", userId);
  if (error) throw error;
  return (data ?? []).map((row) => row.role as AppRole);
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<AuthSession | null>(null);
  const [roles, setRoles] = useState<AppRole[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;

    const applySession = async (nextSession: AuthSession | null) => {
      if (!active) return;
      setSession(nextSession);
      try {
        setRoles(nextSession?.user ? await loadRoles(nextSession.user.id) : []);
      } finally {
        if (active) setLoading(false);
      }
    };

    const unsubscribe = authService.onSessionChanged(
      (nextSession) => void applySession(nextSession),
    );
    void authService
      .getSession()
      .then(applySession)
      .catch(() => applySession(null));
    return () => {
      active = false;
      unsubscribe();
    };
  }, []);

  const value = useMemo<AuthState>(
    () => ({
      session,
      user: session?.user ?? null,
      roles,
      loading,
      signInWithPassword: authService.signInWithPassword,
      signUp: authService.signUp,
      signInWithOAuth: authService.signInWithOAuth,
      signInWithSSO: authService.signInWithSSO,
      signOut: authService.signOut,
      isAdmin: roles.includes("admin"),
      isEditor: roles.includes("admin") || roles.includes("editor"),
    }),
    [loading, roles, session],
  );

  return <AuthCtx.Provider value={value}>{children}</AuthCtx.Provider>;
}

export function useAuth() {
  const context = useContext(AuthCtx);
  if (!context) throw new Error("useAuth must be used inside AuthProvider");
  return context;
}
