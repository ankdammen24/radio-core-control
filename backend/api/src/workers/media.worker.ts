import { logger } from "../core/logger.js";

const NAME = "media.worker";

export async function start(): Promise<void> {
  logger.info(`${NAME} registered (no-op)`);
}
