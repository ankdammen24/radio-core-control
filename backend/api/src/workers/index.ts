import { workerConfig } from "../config/worker.js";
import { logger } from "../core/logger.js";
import { start as startAutomationWorker } from "./automation.worker.js";
import { start as startHealthWorker } from "./health.worker.js";
import { start as startMediaWorker } from "./media.worker.js";
import { start as startPodcastsWorker } from "./podcasts.worker.js";
import { start as startRssWorker } from "./rss.worker.js";

export async function startWorkers(): Promise<void> {
  if (!workerConfig.enabled) {
    logger.info("Workers disabled (WORKERS_ENABLED is not true)");
    return;
  }
  await Promise.all([
    startPodcastsWorker(),
    startAutomationWorker(),
    startMediaWorker(),
    startRssWorker(),
    startHealthWorker(),
  ]);
}
