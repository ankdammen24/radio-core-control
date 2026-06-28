/**
 * Cron endpoint that runs the podcast sync for all active sources.
 *
 * Trigger via pg_cron (recommended every 15 min) with the project's
 * Supabase anon/publishable key as the `apikey` header.
 */
import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/api/public/cron/podcast-sync")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        // Match the pattern used by other /api/public/cron/* routes:
        // require the Supabase anon key in the `apikey` header.
        const apikey = request.headers.get("apikey") ?? "";
        const expected = process.env.SUPABASE_ANON_KEY ?? process.env.SUPABASE_PUBLISHABLE_KEY ?? "";
        if (!expected || apikey !== expected) {
          return new Response(JSON.stringify({ error: "Unauthorized" }), {
            status: 401,
            headers: { "Content-Type": "application/json" },
          });
        }

        try {
          const { syncAllActiveSources } = await import("@/server/podcast-sync.server");
          const results = await syncAllActiveSources();
          const ok = results.every((r) => r.status !== "error");
          return new Response(
            JSON.stringify({
              ok,
              ran_at: new Date().toISOString(),
              sources: results.length,
              results,
            }),
            {
              status: ok ? 200 : 207,
              headers: { "Content-Type": "application/json" },
            },
          );
        } catch (e) {
          console.error("[podcast-sync cron] failed", e);
          return new Response(
            JSON.stringify({ ok: false, error: (e as Error).message }),
            { status: 500, headers: { "Content-Type": "application/json" } },
          );
        }
      },
    },
  },
});
