import type { RateLimitInfo } from './types';

export type HeadersName = (typeof RATE_LIMIT_HEADERS)[number];

export type RateLimitHeaders = Record<HeadersName, string>;

export const RATE_LIMIT_HEADERS = [
  'RateLimit-Policy',
  'RateLimit-Limit',
  'RateLimit-Remaining',
  'RateLimit-Reset',
  'Retry-After',
] as const;

const getResetSeconds = (timestamp: number) => {
  const seconds = Math.round((timestamp - Date.now()) / 1000);

  return Math.max(0, seconds);
};

export const getDraft6Headers = (windowMs: number, info: RateLimitInfo): Omit<RateLimitHeaders, 'Retry-After'> => ({
  'RateLimit-Policy': `${info.limit};w=${Math.round(windowMs / 1000)}`,
  'RateLimit-Limit': info.limit.toString(),
  'RateLimit-Remaining': info.count[1].toString(),
  'RateLimit-Reset': getResetSeconds(info.timestamp).toString(),
});

export const getRetryAfterHeader = (timestamp: number): Pick<RateLimitHeaders, 'Retry-After'> => ({
  'Retry-After': getResetSeconds(timestamp).toString(),
});
