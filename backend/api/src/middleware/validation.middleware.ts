import type { NextFunction, Request, Response } from "express";
import { AppError } from "../core/app-error.js";

export type ValidationResult<T> = { valid: true; value: T } | { valid: false; errors: string[] };
export type Validator<T> = (input: unknown) => ValidationResult<T>;

export function validateBody<T>(validator: Validator<T>) {
  return (req: Request, _res: Response, next: NextFunction): void => {
    const result = validator(req.body);
    if (!result.valid) {
      next(
        new AppError("Validation failed", {
          statusCode: 400,
          code: "VALIDATION_ERROR",
          details: result.errors,
        }),
      );
      return;
    }
    req.body = result.value;
    next();
  };
}
