export interface AppErrorOptions {
  statusCode?: number;
  code?: string;
  details?: unknown;
}

export class AppError extends Error {
  readonly statusCode: number;
  readonly code: string;
  readonly details?: unknown;

  constructor(message: string, options: AppErrorOptions = {}) {
    super(message);
    this.name = "AppError";
    this.statusCode = options.statusCode ?? 500;
    this.code = options.code ?? "INTERNAL_ERROR";
    this.details = options.details;
  }

  static notFound(message = "Resource not found", code = "NOT_FOUND"): AppError {
    return new AppError(message, { statusCode: 404, code });
  }

  static badRequest(message = "Invalid request", code = "BAD_REQUEST"): AppError {
    return new AppError(message, { statusCode: 400, code });
  }
}
