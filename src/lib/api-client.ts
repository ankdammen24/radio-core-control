/**
 * Radio Core API Client
 *
 * Central hjälper för alla HTTP-anrop från frontend till backend.
 *
 * Basurl:  VITE_API_URL (t.ex. https://api.radiouppsala.se)
 * Dev:     http://localhost:3000  (TanStack Start dev server)
 *
 * Alla anrop skickar credentials (cookies) och sätter korrekt Content-Type.
 *
 * Använd:
 *   import { apiClient } from "@/lib/api-client";
 *   const data = await apiClient.get("/api/stations");
 *   const result = await apiClient.post("/api/tokens", { name: "Runner" });
 */

const BASE_URL: string = (() => {
  // Vite-miljövariabler är tillgängliga via import.meta.env
  // I produktion: VITE_API_URL=https://api.radiouppsala.se (sätts i Vercel)
  // I dev: tom sträng → relativa anrop → TanStack Start hanterar /_server/*
  const envUrl = (import.meta as any).env?.VITE_API_URL ?? "";
  return envUrl.replace(/\/$/, ""); // Ta bort eventuell trailing slash
})();

interface RequestOptions extends Omit<RequestInit, "body"> {
  body?: unknown;
  token?: string;
}

interface ApiResponse<T> {
  data: T | null;
  error: string | null;
  status: number;
}

async function request<T = unknown>(
  method: string,
  path: string,
  options: RequestOptions = {},
): Promise<ApiResponse<T>> {
  const { body, token, headers: extraHeaders, ...rest } = options;

  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...(extraHeaders as Record<string, string> ?? {}),
  };

  // Auth: Bearer-token från localStorage (sätts av auth.tsx)
  const storedToken = token ??
    (typeof window !== "undefined" ? window.localStorage.getItem("rc.session_token") : null);
  if (storedToken) {
    headers["Authorization"] = `Bearer ${storedToken}`;
  }

  const url = `${BASE_URL}${path}`;

  try {
    const res = await fetch(url, {
      method,
      headers,
      credentials: "include", // Skicka cookies cross-domain
      body: body !== undefined ? JSON.stringify(body) : undefined,
      ...rest,
    });

    if (res.status === 204) {
      return { data: null, error: null, status: 204 };
    }

    const contentType = res.headers.get("content-type") ?? "";
    const isJson = contentType.includes("application/json");
    const payload = isJson ? await res.json() : await res.text();

    if (!res.ok) {
      const message = isJson
        ? (payload as { error?: string }).error ?? res.statusText
        : String(payload);
      return { data: null, error: message, status: res.status };
    }

    return { data: payload as T, error: null, status: res.status };
  } catch (err) {
    const message = err instanceof Error ? err.message : "Nätverksfel";
    return { data: null, error: message, status: 0 };
  }
}

export const apiClient = {
  get: <T = unknown>(path: string, options?: RequestOptions) =>
    request<T>("GET", path, options),

  post: <T = unknown>(path: string, body?: unknown, options?: RequestOptions) =>
    request<T>("POST", path, { ...options, body }),

  put: <T = unknown>(path: string, body?: unknown, options?: RequestOptions) =>
    request<T>("PUT", path, { ...options, body }),

  patch: <T = unknown>(path: string, body?: unknown, options?: RequestOptions) =>
    request<T>("PATCH", path, { ...options, body }),

  delete: <T = unknown>(path: string, options?: RequestOptions) =>
    request<T>("DELETE", path, options),

  /** Bas-URL som används — användbart för debug */
  baseUrl: BASE_URL,
};

export type { ApiResponse };
