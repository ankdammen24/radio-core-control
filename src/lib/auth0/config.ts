import { AUTH0_ENABLED, env } from "@/config/env";

export const auth0Configuration = Object.freeze({
  enabled: AUTH0_ENABLED,
  domain: env.auth0Domain,
  clientId: env.auth0ClientId,
  audience: env.auth0Audience,
  callbackUrl: env.auth0CallbackUrl,
  logoutUrl: env.auth0LogoutUrl,
  get configured() {
    return AUTH0_ENABLED;
  },
});

export { AUTH0_ENABLED };
