export interface ApiMeta {
  [key: string]: unknown;
}

export interface ApiSuccessResponse<T> {
  success: true;
  data: T;
  meta?: ApiMeta;
}

export interface ApiErrorBody {
  message: string;
  code: string;
}

export interface ApiErrorResponse {
  success: false;
  error: ApiErrorBody;
}

export type ApiResponse<T> = ApiSuccessResponse<T> | ApiErrorResponse;
