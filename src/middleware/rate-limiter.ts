import type { Context, Next } from 'hono';

import { MyResponse, Status } from '#pkg/http-response/index.ts';
import { rateLimiter } from '#pkg/rate-limit';
import type { RateLimitHeaders } from '#pkg/rate-limit/headers.ts';

// Standard de-facto proxy headers, in priority order.
const headers = ['x-real-ip', 'x-forwarded-for', 'cf-connecting-ip', 'fly-client-ip'];

const keyGenerator = (c: Context): string => {
  const key = `m:${c.req.method},p:${c.req.path}`;

  for (const header of headers) {
    const value = c.req.header(header);
    if (value) {
      // x-forwarded-for can be a comma-separated list: "client, proxy1, proxy2"
      const ip = value.split(',')[0]?.trim();

      if (ip) {
        return `${key},ip:${ip}`;
      }
    }
  }

  return `${key},ip:unknown`;
};

const onRateLimited = (_c: Context, _: Next, headers: RateLimitHeaders) => {
  return MyResponse.error({
    message: `Too many requests. Please try again in ${headers['Retry-After']} seconds.`,
    code: 'RATE_LIMIT_EXCEEDED',
    status: Status.TooManyRequests,
    headers,
  });
};

/**
 * Global limiter applied to all routes.
 * 200 requests per IP per minute — blocks abusive bots while being
 * completely transparent to legitimate clients.
 */
export const globalLimiter = rateLimiter({
  keyGenerator,
  limit: 200,
  skip: (c) => /\/(auth|sessions)(\/|$)/.test(c.req.path),
  onRateLimited,
});

/**
 * Auth limiter applied to /auth routes.
 *
 * 10 attempts per IP 15 minutes.
 * 60 attempts per IP 15 minutes — legitimate clients refresh often.
 */
export const authLimiter = rateLimiter({
  keyGenerator,
  windowMs: 900_000,
  limit: (c) => (c.req.path === '/auth/refresh' ? 60 : 10),
  skipSuccessfulRequests: true,
  onRateLimited,
});
