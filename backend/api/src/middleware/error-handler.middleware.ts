import type { NextFunction, Request, Response } from "express";
import { AppError } from "../core/app-error.js";
import { sendError } from "../core/api-response.js";
import { logger } from "../core/logger.js";

export function errorHandler(err: unknown, req: Request, res: Response, _next: NextFunction): void {
  if (err instanceof AppError) {
    logger.warn(err.message, { requestId: req.id, code: err.code, details: err.details });
    sendError(res, err.statusCode, err.message, err.code);
    return;
  }

  const message = err instanceof Error ? err.message : "Internal server error";
  logger.error(message, {
    requestId: req.id,
    stack: err instanceof Error ? err.stack : undefined,
  });
  sendError(res, 500, "Internal server error", "INTERNAL_ERROR");
}
