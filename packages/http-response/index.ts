import type { ErrorOptions, ErrorResponse, Headers, SuccessOptions, SuccessResponse } from './types';

import { type ErrorStatus, Status } from './status';

export const MyResponse = {
  error(options: ErrorOptions) {
    const { message, code, details, status = Status.InternalServerError, headers } = options;

    const body: ErrorResponse = {
      success: false,
      error: {
        message,
        code,
      },
    };

    if (details) body.error.details = details;

    return Response.json(body, {
      status,
      headers: {
        'Content-Type': 'application/json',
        ...headers,
      },
    });
  },

  success<D>(options: SuccessOptions<D>) {
    const { data, meta, status = Status.Ok, headers } = options;

    const body: SuccessResponse<D> = {
      success: true,
      data,
    };

    if (meta) body.meta = meta;

    return Response.json(body, {
      status,
      headers: {
        'Content-Type': 'application/json',
        ...headers,
      },
    });
  },

  /** 204 No Content */
  NoContent(headers?: Headers) {
    return new Response(null, {
      status: Status.NoContent,
      headers,
    });
  },

  /** 308 Permanent Redirect */
  PermanentRedirect(url: string, headers?: Headers) {
    return Response.redirect(url, {
      status: Status.PermanentRedirect,
      headers,
    });
  },
};

export class HttpError extends Error {
  override name = 'HttpError';

  code: string;
  details?: unknown;
  status: ErrorStatus;
  headers?: Headers;

  /** 400 Bad Request */
  static BadRequest(message: string, issues: unknown, headers?: Headers) {
    return new HttpError({
      message,
      code: 'VALIDATION',
      details: {
        issues,
      },
      status: Status.BadRequest,
      headers,
    });
  }

  /** 404 Not Found */
  static NotFound(message: string, url: string, headers?: Headers) {
    return new HttpError({
      message,
      code: 'NOT_FOUND',
      details: {
        url,
      },
      status: Status.NotFound,
      headers,
    });
  }

  constructor(options: ErrorOptions) {
    const { message, code, details, status = Status.InternalServerError, headers } = options;

    super(message);

    this.code = code;
    this.details = details;
    this.status = status;
    this.headers = headers;
  }

  toResponse() {
    return MyResponse.error({
      message: this.message,
      code: this.code,
      details: this.details,
      status: this.status,
      headers: this.headers,
    });
  }
}

export { Status };
