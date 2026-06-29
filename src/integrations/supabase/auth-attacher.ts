/**
 * Auth attacher middleware stub — Supabase har tagits bort.
 *
 * Exporterar `attachSupabaseAuth` med samma sökväg.
 * Läser en lokal session-token från localStorage (om tillgängligt) och
 * bifogar den som Authorization-header till serverFn-anrop.
 *
 * TODO: ersätt med riktigt session-token-hantering när lokal auth är klar.
 */
import { createMiddleware } from "@tanstack/react-start";

const LOCAL_SESSION_KEY = "rc.session_token";

export const attachSupabaseAuth = createMiddleware({ type: "function" }).client(
  async ({ next }) => {
    let token: string | null = null;
    if (typeof window !== "undefined") {
      token = window.localStorage.getItem(LOCAL_SESSION_KEY);
    }
    return next({
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    });
  },
);
