import { env } from "@/config/env";

export const API_BASE_URL = env.apiUrl;

export interface ApiResponse<T> {
  data: T | null;
  error: string | null;
  status: number;
}

export class ApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly payload?: unknown,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

export interface ApiRequestOptions extends Omit<RequestInit, "body"> {
  body?: unknown;
  accessToken?: string | null;
}

function resolveUrl(path: string) {
  if (/^https?:\/\//i.test(path)) {
    throw new Error(
      "API paths must be relative. Configure VITE_API_URL instead of hardcoding a host.",
    );
  }
  const normalizedPath = path.startsWith("/") ? path : `/${path}`;
  return `${API_BASE_URL}${normalizedPath}`;
}

async function parseResponse(response: Response): Promise<unknown> {
  if (response.status === 204) return null;
  const text = await response.text();
  if (!text.trim()) return null;
  const contentType = response.headers.get("content-type") ?? "";
  if (!contentType.includes("application/json")) return text;
  try {
    return JSON.parse(text) as unknown;
  } catch {
    throw new ApiError("Backend returned invalid JSON", response.status, text);
  }
}

function errorMessage(payload: unknown, fallback: string) {
  if (payload && typeof payload === "object" && "error" in payload) {
    const value = (payload as { error?: unknown }).error;
    if (typeof value === "string") return value;
  }
  if (payload && typeof payload === "object" && "message" in payload) {
    const value = (payload as { message?: unknown }).message;
    if (typeof value === "string") return value;
  }
  return typeof payload === "string" && payload.trim() ? payload : fallback;
}

async function request<T>(
  method: string,
  path: string,
  options: ApiRequestOptions = {},
): Promise<ApiResponse<T>> {
  const { body, accessToken, headers: suppliedHeaders, ...requestOptions } = options;
  const headers = new Headers(suppliedHeaders);
  headers.set("Accept", "application/json, text/plain;q=0.9");
  if (body !== undefined && !(body instanceof FormData))
    headers.set("Content-Type", "application/json");
  if (accessToken) headers.set("Authorization", `Bearer ${accessToken}`);

  try {
    const response = await fetch(resolveUrl(path), {
      ...requestOptions,
      method,
      headers,
      credentials: "include",
      body: body === undefined ? undefined : body instanceof FormData ? body : JSON.stringify(body),
    });
    const payload = await parseResponse(response);
    if (!response.ok) {
      return {
        data: null,
        error: errorMessage(payload, response.statusText),
        status: response.status,
      };
    }
    return { data: payload as T, error: null, status: response.status };
  } catch (error) {
    if (error instanceof ApiError) {
      return { data: null, error: error.message, status: error.status };
    }
    return {
      data: null,
      error: error instanceof Error ? error.message : "Radio Core Backend is unavailable",
      status: 0,
    };
  }
}

export const apiClient = {
  get: <T>(path: string, options?: ApiRequestOptions) => request<T>("GET", path, options),
  post: <T>(path: string, body?: unknown, options?: ApiRequestOptions) =>
    request<T>("POST", path, { ...options, body }),
  put: <T>(path: string, body?: unknown, options?: ApiRequestOptions) =>
    request<T>("PUT", path, { ...options, body }),
  patch: <T>(path: string, body?: unknown, options?: ApiRequestOptions) =>
    request<T>("PATCH", path, { ...options, body }),
  delete: <T>(path: string, options?: ApiRequestOptions) => request<T>("DELETE", path, options),
  baseUrl: API_BASE_URL,
};
