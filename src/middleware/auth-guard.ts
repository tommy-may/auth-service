import { createMiddleware } from 'hono/factory';

import { HttpError, Status } from '#pkg/http-response';

import { Repository } from '@/db/repository';
import { type AccessTokenPayload, verifyAccessToken } from '@/lib/jwt';

type Env = {
  Variables: {
    jwt: AccessTokenPayload;
  };
};

export const authGuard = createMiddleware<Env>(async (c, next) => {
  try {
    const auth = c.req.header('Authorization') || '';
    const [, token] = auth.split(' ');

    if (!auth.startsWith('Bearer ') || !token) {
      throw new HttpError({
        message: 'Token malformed or missing',
        code: 'INVALID_TOKEN',
        status: Status.Unauthorized,
      });
    }

    const payload = await verifyAccessToken(token);

    if (await Repository.blacklist.validate.jti.invalid(payload.jti)) {
      throw new Error('Token validation failed');
    }

    c.set('jwt', payload);

    await next();
  } catch (e) {
    if (e instanceof HttpError) throw e;

    const message = e instanceof Error ? e.message : 'Token validation failed';

    throw new HttpError({
      message,
      code: 'INVALID_TOKEN',
      status: Status.Forbidden,
    });
  }
});
