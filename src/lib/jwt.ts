import { sign, verify } from 'hono/jwt';

import { env } from '@/config/env';

import { generateRandomValue, msToSeconds, uuidv7 } from './utils';

export interface AccessTokenPayload {
  iss?: string;
  sub: string;
  aud?: string | string[];
  jti: string;
  nbf?: number;
  iat: number;
  exp: number;
  email: string;
}

const ALGORITHM = 'HS256';

const REFRESH_TOKEN_TTL_S = 604_800; // 7d
const ACCESS_TOKEN_TTL_S = 900; // 15m

export const generateRefreshToken = (): [string, Date] => [
  generateRandomValue(),
  new Date((msToSeconds(Date.now()) + REFRESH_TOKEN_TTL_S) * 1000),
];

export const signAccessToken = async ({
  sub,
  email,
}: Pick<AccessTokenPayload, 'sub' | 'email'>): Promise<[string, string, Date]> => {
  const jti = uuidv7();

  const iat = msToSeconds(Date.now());
  const exp = iat + ACCESS_TOKEN_TTL_S;

  const jwt = await sign({ sub, jti, iat, exp, email }, env.JWT_SECRET, ALGORITHM);

  return [jwt, jti, new Date(exp * 1000)];
};

export const verifyAccessToken = async (token: string): Promise<AccessTokenPayload> => {
  const payload = (await verify(token, env.JWT_SECRET, ALGORITHM)) as unknown as AccessTokenPayload;

  if (!payload.sub || !payload.jti || typeof payload.email !== 'string') {
    throw new Error('Invalid token payload');
  }

  return payload;
};
