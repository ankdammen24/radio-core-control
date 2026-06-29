/**
 * Radio Core Workers — Bakgrundsjobb via BullMQ + Redis
 *
 * Ansluter till Redis för jobbkö och MongoDB för datalagring.
 * Ingen port exponeras — intern tjänst.
 *
 * Jobbtyper (placeholder):
 *   media:process      — Transkoda uppladdade filer, generera artwork
 *   podcast:import     — Importera avsnitt från extern RSS-källa
 *   cleanup:orphans    — Ta bort oanvända mediafiler
 *   stream:sync-meta   — Synkronisera stream-metadata från AzuraCast
 */

const REDIS_URL   = process.env.REDIS_URL   ?? "redis://redis:6379";
const MONGODB_URL = process.env.MONGODB_URL ?? "mongodb://mongodb:27017/radiocore";

// ─── Job definitions ──────────────────────────────────────────────────────────

interface Job {
  name: string;
  description: string;
  handler: (data: unknown) => Promise<void>;
}

const JOBS: Job[] = [
  {
    name: "media:process",
    description: "Transkoda uppladdade mediafiler och generera thumbnails",
    handler: async (data) => {
      console.log("[worker] media:process", JSON.stringify(data));
      // TODO: anropa ffmpeg för transkodning
      // TODO: ladda upp result till R2
      // TODO: uppdatera media_files-tabell (MongoDB)
    },
  },
  {
    name: "podcast:import",
    description: "Importera avsnitt från extern RSS-källa",
    handler: async (data) => {
      console.log("[worker] podcast:import", JSON.stringify(data));
      // TODO: hämta RSS-feed
      // TODO: parsa och upserta avsnitt i MongoDB
      // TODO: trigga media:process för varje nytt avsnitt
    },
  },
  {
    name: "cleanup:orphans",
    description: "Ta bort mediafiler som inte längre refereras av något avsnitt",
    handler: async (data) => {
      console.log("[worker] cleanup:orphans", JSON.stringify(data));
      // TODO: hämta alla media_files utan podcast_episode-referens
      // TODO: ta bort från R2 + MongoDB
    },
  },
  {
    name: "stream:sync-meta",
    description: "Synkronisera stream-metadata (now-playing) från AzuraCast",
    handler: async (data) => {
      console.log("[worker] stream:sync-meta", JSON.stringify(data));
      // TODO: anropa AzuraCast API
      // TODO: upserta now_playing i PostgreSQL
    },
  },
];

// ─── Startup ──────────────────────────────────────────────────────────────────

console.log(`[radio-core-workers] Redis:   ${REDIS_URL}`);
console.log(`[radio-core-workers] MongoDB: ${MONGODB_URL}`);
console.log(`[radio-core-workers] Registrerade jobb:`);
for (const job of JOBS) {
  console.log(`  - ${job.name}: ${job.description}`);
}

console.log("\n[radio-core-workers] TODO: Anslut BullMQ och registrera workers.");
console.log("[radio-core-workers] Exempel:");
console.log("  import { Worker } from 'bullmq';");
console.log("  const worker = new Worker('media', job => handlers[job.name](job.data), { connection });");

// ─── Graceful shutdown ───────────────────────────────────────────────────────
process.on("SIGTERM", () => {
  console.log("[radio-core-workers] SIGTERM — stänger ned.");
  // TODO: worker.close() för varje BullMQ-worker
  process.exit(0);
});

process.on("SIGINT", () => {
  console.log("[radio-core-workers] SIGINT — stänger ned.");
  process.exit(0);
});

// Håll processen vid liv
setInterval(() => {}, 30_000);
