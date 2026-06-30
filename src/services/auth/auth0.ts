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

export async function checkAuth0Reachability() {
  if (!auth0Configuration.configured) {
    return {
      configured: false,
      reachable: false,
      message: "Auth0 environment variables are not configured",
    };
  }
  const domain = auth0Configuration.domain.replace(/^https?:\/\//, "").replace(/\/$/, "");
  try {
    const response = await fetch(`https://${domain}/.well-known/openid-configuration`, {
      method: "GET",
      cache: "no-store",
    });
    return {
      configured: true,
      reachable: response.ok,
      message: response.ok
        ? "Auth0 discovery is available"
        : `Auth0 returned HTTP ${response.status}`,
    };
  } catch (error) {
    return {
      configured: true,
      reachable: false,
      message: error instanceof Error ? error.message : "Auth0 is unavailable",
    };
  }
}
