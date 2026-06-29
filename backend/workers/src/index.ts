/**
 * Radio Core Workers
 *
 * Bakgrundsjobb via BullMQ (Redis-backed).
 *
 * TODO:
 *   - media:transcode    — Konvertera uppladdade filer till MP3/AAC
 *   - media:artwork      — Generera thumbnails
 *   - notify:slack       — Skicka Slack-notiser för stream-händelser
 *   - stats:aggregate    — Aggregera lyssnarsstatistik per timme
 */

const REDIS_URL = process.env.REDIS_URL ?? "redis://redis:6379";

console.log(`[radio-core-workers] Startar. Redis: ${REDIS_URL}`);
console.log("[radio-core-workers] TODO: anslut BullMQ-workers när Redis är nåbar.");

// Håll processen vid liv
process.on("SIGTERM", () => {
  console.log("[radio-core-workers] SIGTERM mottagen, stänger ner.");
  process.exit(0);
});

setInterval(() => {
  // Heartbeat — ersätts av faktisk jobb-processning
}, 30_000);
