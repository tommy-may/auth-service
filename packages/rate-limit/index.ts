import type { Env, Input } from 'hono';

import { createMiddleware } from 'hono/factory';

import type { Config, RateLimitInfo } from './types';

import { getDraft6Headers, getRetryAfterHeader } from './headers';
import { MemoryStore } from './memory-store';

const TOO_MANY_REQUESTS_STATUS_CODE = 429;

export const rateLimiter = <E extends Env = Env, P extends string = string, I extends Input = Input>(
  config: Config<E, P, I>,
) => {
  const {
    keyGenerator,
    store = new MemoryStore(),
    windowMs = 60_000,
    limit: _limit = 5,
    skipFailedRequests = false,
    skipSuccessfulRequests = false,
    skip = () => false,
    onRateLimited = (c, _, headers) =>
      c.text('Too many requests. Please try again later.', TOO_MANY_REQUESTS_STATUS_CODE, headers),
  } = config;

  store.init(windowMs);

  return createMiddleware<E, P, I>(async (c, next) => {
    if (await skip(c)) {
      await next();

      return;
    }

    const limit = typeof _limit === 'function' ? await _limit(c) : _limit;

    const key = await keyGenerator(c);
    const { count, timestamp } = store.increment(key);

    const info: RateLimitInfo = {
      limit,
      count: [count, Math.max(0, limit - count)],
      timestamp,
    };

    if (count >= limit) {
      return onRateLimited(c, next, {
        ...getDraft6Headers(windowMs, info),
        ...getRetryAfterHeader(timestamp),
      });
    }

    await next();

    const successful = c.res.status < 400;

    if ((skipFailedRequests && !successful) || (skipSuccessfulRequests && successful)) {
      store.decrement(key);

      info.count = [count - 1, Math.max(0, limit - (count - 1))];
    }

    const headers = getDraft6Headers(windowMs, info);
    for (const header in headers) {
      c.res.headers.append(header, headers[header as never]);
    }
  });
};
