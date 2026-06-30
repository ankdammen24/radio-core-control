import type { NextFunction, Request, Response } from "express";
import { logger } from "../core/logger.js";

export function requestLogger(req: Request, res: Response, next: NextFunction): void {
  const startedAt = Date.now();
  res.on("finish", () => {
    logger.info("request completed", {
      requestId: req.id,
      method: req.method,
      path: req.originalUrl,
      statusCode: res.statusCode,
      durationMs: Date.now() - startedAt,
    });
  });
  next();
}
