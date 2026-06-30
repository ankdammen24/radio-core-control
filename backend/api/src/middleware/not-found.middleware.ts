import type { NextFunction, Request, Response } from "express";
import { sendError } from "../core/api-response.js";

export function notFound(req: Request, res: Response, _next: NextFunction): void {
  sendError(res, 404, `Route not found: ${req.method} ${req.originalUrl}`, "ROUTE_NOT_FOUND");
}
