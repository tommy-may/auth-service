import type { ErrorStatus, SuccessStatus } from './status';

export type Meta = Record<string, unknown>;

export type Headers = Record<string, string>;

export type SuccessResponse<D> = {
  success: true;
  data: D;
  meta?: Meta;
};

export type SuccessOptions<D> = {
  data: D;
  meta?: Meta;
  status?: SuccessStatus;
  headers?: Headers;
};

export type ErrorResponse = {
  success: false;
  error: {
    message?: string;
    code: string;
    details?: unknown;
  };
};

export type ErrorOptions = {
  message?: string;
  code: string;
  details?: unknown;
  status?: ErrorStatus;
  headers?: Headers;
};
