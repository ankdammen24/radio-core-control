import { LOCAL_AUTH_ENABLED, SUPABASE_ENABLED } from "@/config/env";
import { guestAuthService, localAuthService } from "./fallback";
import { supabaseAuthService } from "./supabase";
import type { AuthMode } from "./types";

export const AUTH_MODE: AuthMode = SUPABASE_ENABLED
  ? "supabase"
  : LOCAL_AUTH_ENABLED
    ? "local"
    : "guest";

export const authService =
  AUTH_MODE === "supabase"
    ? supabaseAuthService
    : AUTH_MODE === "local"
      ? localAuthService
      : guestAuthService;

export const LOGIN_CONFIGURED = AUTH_MODE === "supabase";

export type {
  AppRole,
  AuthMode,
  AuthService,
  AuthSession,
  AuthUser,
  SocialProvider,
} from "./types";
