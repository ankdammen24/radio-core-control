import type { Response } from "express";
import type { ApiErrorResponse, ApiMeta, ApiSuccessResponse } from "../types/api-response.types.js";

export function sendSuccess<T>(res: Response, data: T, meta?: ApiMeta, statusCode = 200): void {
  const body: ApiSuccessResponse<T> = { success: true, data, ...(meta ? { meta } : {}) };
  res.status(statusCode).json(body);
}

export function sendError(res: Response, statusCode: number, message: string, code: string): void {
  const body: ApiErrorResponse = { success: false, error: { message, code } };
  res.status(statusCode).json(body);
}
