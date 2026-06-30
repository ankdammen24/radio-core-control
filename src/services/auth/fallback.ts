import type { AuthService, AuthSession } from "./types";

const localAdminSession: AuthSession = {
  access_token: "",
  user: { id: "local-admin", email: "local-admin@radio-core.local" },
};

const guestSession: AuthSession = {
  access_token: "",
  user: { id: "guest", email: null },
};

function unsupported(): never {
  throw new Error("Login not configured");
}

function staticSessionService(session: AuthSession): AuthService {
  return {
    async getSession() {
      return session;
    },
    onSessionChanged() {
      return () => undefined;
    },
    async signInWithPassword() {
      unsupported();
    },
    async signUp() {
      unsupported();
    },
    async signInWithOAuth() {
      unsupported();
    },
    async signInWithSSO() {
      return unsupported();
    },
    async signOut() {
      // Guest/local bootstrap sessions are controlled by environment config.
    },
  };
}

export const localAuthService = staticSessionService(localAdminSession);
export const guestAuthService = staticSessionService(guestSession);
