import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { requestId } from 'hono/request-id';

import { HttpError, MyResponse, Status } from '#pkg/http-response';
import { RATE_LIMIT_HEADERS } from '#pkg/rate-limit/headers';

import { env } from '@/config/env';
import { globalLimiter } from '@/middleware/rate-limiter';

const DEV = env.NODE_ENV !== 'production';

export const createRoute = () => new Hono({ strict: false });

export const createApp = () =>
  createRoute()
    .use(
      '/auth/*',
      cors({
        origin: env.ALLOWED_ORIGINS,
        allowHeaders: ['Authorization-Refresh-Token'],
        allowMethods: ['POST', 'GET', 'DELETE', 'OPTIONS'],
        exposeHeaders: ['X-Refresh-Token', 'X-Refresh-Token-Expires', ...RATE_LIMIT_HEADERS],
        maxAge: 600,
        credentials: true,
      }),
    )
    .use(requestId())
    .use(globalLimiter)
    .notFound((c) => c.text(`Route Not Found \`${c.req.path}\``, Status.NotFound))
    .onError((e) => {
      if (e instanceof HttpError) return e.toResponse();

      return MyResponse.error({
        message: e.message,
        code: 'SERVER_ERROR',
        ...(DEV
          ? {
              details: {
                stack: e.stack,
              },
            }
          : {}),
      });
    });
