import { auth0Configuration } from "@/lib/auth0/config";

export { auth0Configuration };

export async function checkAuth0Reachability() {
  if (!auth0Configuration.enabled) {
    return {
      configured: false,
      reachable: false,
      message: "Auth0 legacy integration is disabled",
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
