/**
 * Auth middleware stub — Supabase har tagits bort.
 *
 * Exporterar `requireSupabaseAuth` med samma sökväg och kontraktstyp.
 * Stub-implementationen accepterar alla Bearer-tokens med en placeholder
 * claims-struktur tills vi implementerar riktig JWT-verifiering.
 *
 * TODO: ersätt med JWT-verifiering mot lokal sessions-tabell:
 *   1. Läs Authorization: Bearer <token>
 *   2. Verifiera JWT mot JWT_SECRET / hämta session från sessions-tabellen
 *   3. Returnera userId + claims i context
 */
import { createMiddleware } from "@tanstack/react-start";
import { getRequest } from "@tanstack/react-start/server";

export const requireSupabaseAuth = createMiddleware({ type: "function" }).server(
  async ({ next }) => {
    const request = getRequest();

    if (!request?.headers) {
      throw new Response("Unauthorized: No request headers available", { status: 401 });
    }

    const authHeader = request.headers.get("authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      throw new Response("Unauthorized: Bearer token required", { status: 401 });
    }

    const token = authHeader.replace("Bearer ", "").trim();
    if (!token) {
      throw new Response("Unauthorized: Empty token", { status: 401 });
    }

    // TODO: verifiera token mot JWT_SECRET och sessions-tabellen
    // Temporärt: accepterar alla tokens i dev-läge
    const claims: Record<string, unknown> = {
      sub: "dev-user-stub",
      role: "admin",
    };

    return next({
      context: {
        // supabase-fältet tas bort när konsumenter är migrerade
        supabase: null,
        userId: claims.sub as string,
        claims,
      },
    });
  },
);
