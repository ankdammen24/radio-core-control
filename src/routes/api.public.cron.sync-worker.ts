// Cron-triggered endpoint. pg_cron pings this every minute with the anon key.
import { createFileRoute } from "@tanstack/react-router";
import { runSyncWorker } from "@/server/sync-worker.server";

export const Route = createFileRoute("/api/public/cron/sync-worker")({
  server: {
    handlers: {
      POST: async () => {
        try {
          const result = await runSyncWorker({ limit: 25, worker: "cron" });
          return Response.json({ ok: true, ...result });
        } catch (e) {
          const message = e instanceof Error ? e.message : String(e);
          return Response.json({ ok: false, message }, { status: 500 });
        }
      },
      GET: async () => {
        // Allow manual trigger via browser for debugging
        try {
          const result = await runSyncWorker({ limit: 10, worker: "manual-get" });
          return Response.json({ ok: true, ...result });
        } catch (e) {
          const message = e instanceof Error ? e.message : String(e);
          return Response.json({ ok: false, message }, { status: 500 });
        }
      },
    },
  },
});
