/**
 * Radio Core Scheduler
 *
 * Återkommande cron-jobb via node-cron.
 *
 * Jobb (placeholder — implementeras i respektive handler):
 *   - podcast:rss-check       Dagligen 06:00   Hämta nya avsnitt från RSS
 *   - media:orphan-cleanup    Dagligen 03:00   Ta bort oanvända mediafiler
 *   - stream:health-check     Var 5:e minut    Kontrollera stream-status
 *   - metadata:refresh        Var 30:e minut   Synka now-playing från AzuraCast
 */

import cron from "node-cron";

interface Job {
  name: string;
  schedule: string;
  fn: () => Promise<void>;
}

const jobs: Job[] = [
  {
    name: "podcast:rss-check",
    schedule: "0 6 * * *",
    fn: async () => {
      console.log("[scheduler] podcast:rss-check — TODO: hämta RSS-feeds");
    },
  },
  {
    name: "media:orphan-cleanup",
    schedule: "0 3 * * *",
    fn: async () => {
      console.log("[scheduler] media:orphan-cleanup — TODO: ta bort oanvända filer");
    },
  },
  {
    name: "stream:health-check",
    schedule: "*/5 * * * *",
    fn: async () => {
      console.log("[scheduler] stream:health-check — TODO: kontrollera stream");
    },
  },
  {
    name: "metadata:refresh",
    schedule: "*/30 * * * *",
    fn: async () => {
      console.log("[scheduler] metadata:refresh — TODO: synka now-playing");
    },
  },
];

for (const job of jobs) {
  cron.schedule(job.schedule, async () => {
    try {
      await job.fn();
    } catch (err) {
      console.error(`[scheduler] ${job.name} misslyckades:`, err);
    }
  });
  console.log(`[scheduler] Registrerat: ${job.name} (${job.schedule})`);
}

console.log(`[scheduler] ${jobs.length} jobb aktiva.`);

process.on("SIGTERM", () => {
  console.log("[scheduler] SIGTERM mottagen, stänger ner.");
  process.exit(0);
});
