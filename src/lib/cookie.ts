import type { CookieOptions } from 'hono/utils/cookie';

import { env } from '@/config/env';

import { msToSeconds } from './utils';

const SECURE = env.NODE_ENV === 'production';

const calcMaxAge = (timestamp: number) => {
  const now = msToSeconds(Date.now());
  const seconds = msToSeconds(timestamp);

  return seconds <= now ? 0 : seconds - now;
};

export const getCookieOptions = (expires: Date, path = '/'): CookieOptions => ({
  path,
  secure: SECURE,
  httpOnly: true,
  maxAge: calcMaxAge(expires.getTime()),
  expires,
  sameSite: 'Strict',
});

export enum CookieKey {
  RefreshToken = 'refresh_token',
}
