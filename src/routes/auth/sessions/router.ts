import { deleteCookie, getCookie } from 'hono/cookie';

import { MyResponse } from '#pkg/http-response';

import { CookieKey, getCookieOptions } from '@/lib/cookie';
import { createRoute } from '@/lib/create-app';
import { authGuard } from '@/middleware/auth-guard';
import { zodValidator } from '@/middleware/zod-validator';

import { DeleteByIdParamSchema, DeleteQuerySchema } from './schema';
import { SessionsServices } from './services';

export const sessionsRoute = createRoute()
  .use(authGuard)
  .get('/', async (c) => {
    const sessions = await SessionsServices.read(c.var.jwt.sub);

    return MyResponse.success({
      data: { sessions },
    });
  })
  .delete('/:id', zodValidator('param', DeleteByIdParamSchema), async (c) => {
    const { id } = c.req.valid('param');
    await SessionsServices.logout(c.var.jwt.sub, id);

    return MyResponse.NoContent();
  })
  .delete('/', zodValidator('query', DeleteQuerySchema), async (c) => {
    const { keep_current } = c.req.valid('query');
    const cValue = getCookie(c, CookieKey.RefreshToken);

    await SessionsServices.invalidate(
      keep_current,
      c.var.jwt.sub,
      cValue || c.req.header('Authorization-Refresh-Token'),
    );

    if (!keep_current) {
      deleteCookie(c, CookieKey.RefreshToken, getCookieOptions(new Date()));
    }

    return MyResponse.NoContent();
  });
