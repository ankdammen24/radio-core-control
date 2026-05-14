// Cron-triggered endpoint. Requires Authorization: Bearer <CRON_SECRET>.
// Falls back to SUPABASE_SERVICE_ROLE_KEY for backwards compatibility.
import { createFileRoute } from "@tanstack/react-router";
import { runSyncWorker } from "@/server/sync-worker.server";
import { readEnv } from "@/server/env.server";

function authorize(request: Request): boolean {
  const expected = readEnv("CRON_SECRET") ?? readEnv("SUPABASE_SERVICE_ROLE_KEY");
  if (!expected) return false;
  const header = request.headers.get("authorization") ?? "";
  const token = header.replace(/^Bearer\s+/i, "").trim();
  return token.length > 0 && token === expected;
}

export const Route = createFileRoute("/api/public/cron/sync-worker")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        if (!authorize(request)) {
          return new Response(JSON.stringify({ ok: false, message: "Unauthorized" }), {
            status: 401,
            headers: { "Content-Type": "application/json" },
          });
        }
        try {
          const result = await runSyncWorker({ limit: 25, worker: "cron" });
          return Response.json({ ok: true, ...result });
        } catch (e) {
          const message = e instanceof Error ? e.message : String(e);
          return Response.json({ ok: false, message }, { status: 500 });
        }
      },
    },
  },
});
