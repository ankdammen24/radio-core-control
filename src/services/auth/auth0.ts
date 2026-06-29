/**
 * Auth0 stays an explicit provider boundary during the staged migration.
 * The current UI session remains on Supabase until the Auth0 SDK/bootstrap
 * used by the Vercel deployment is wired to the AuthService contract.
 */
export const auth0Configuration = {
  domain: import.meta.env.VITE_AUTH0_DOMAIN?.trim() ?? "",
  clientId: import.meta.env.VITE_AUTH0_CLIENT_ID?.trim() ?? "",
  audience: import.meta.env.VITE_AUTH0_AUDIENCE?.trim() ?? "",
  get configured() {
    return Boolean(this.domain && this.clientId && this.audience);
  },
};
