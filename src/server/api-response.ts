export function jsonSuccess<T>(data: T, status = 200): Response {
  return new Response(JSON.stringify({ success: true, data }), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

export function jsonError(message: string, code: string, status = 400): Response {
  return new Response(JSON.stringify({ success: false, error: { message, code } }), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

export async function readJsonBody(request: Request): Promise<Record<string, unknown>> {
  try {
    const body = await request.json();
    return body && typeof body === "object" ? (body as Record<string, unknown>) : {};
  } catch {
    return {};
  }
}
