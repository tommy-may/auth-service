import { deleteCookie, getCookie, setCookie } from 'hono/cookie';

import { MyResponse, Status } from '#pkg/http-response';

import { CookieKey, getCookieOptions } from '@/lib/cookie';
import { createRoute } from '@/lib/create-app';
import { authGuard } from '@/middleware/auth-guard';
import { authLimiter } from '@/middleware/rate-limiter';
import { zodValidator } from '@/middleware/zod-validator';
import { LoginSchema, PasswordResetSchema, RegisterSchema } from '@/schema/user';

import { AuthServices } from './services';
import { sessionsRoute } from './sessions/router';

export const authRoute = createRoute()
  .use(authLimiter)
  .post('/register', zodValidator('json', RegisterSchema), async (c) => {
    const { email, password } = c.req.valid('json');
    const user = await AuthServices.register({ email: email.toLowerCase().trim(), password });

    return MyResponse.success({
      data: { user },
      status: Status.Created,
    });
  })
  .post('/login', zodValidator('json', LoginSchema), async (c) => {
    const { email, password } = c.req.valid('json');
    const { token, value, valueExpiresAt } = await AuthServices.login(
      { email: email.toLowerCase().trim(), password },
      c.req.header('User-Agent') || null,
    );

    setCookie(c, CookieKey.RefreshToken, value, getCookieOptions(valueExpiresAt));

    return MyResponse.success({
      data: { token },
      headers: {
        'X-Refresh-Token': value,
        'X-Refresh-Token-Expires': valueExpiresAt.toISOString(),
      },
    });
  })
  .post('/refresh', async (c) => {
    const cValue = getCookie(c, CookieKey.RefreshToken);
    const { token, value, valueExpiresAt } = await AuthServices.refresh(
      c.req.header('User-Agent') || null,
      cValue || c.req.header('Authorization-Refresh-Token'),
    );

    setCookie(c, CookieKey.RefreshToken, value, getCookieOptions(valueExpiresAt));

    return MyResponse.success({
      data: { token },
      headers: {
        'X-Refresh-Token': value,
        'X-Refresh-Token-Expires': valueExpiresAt.toISOString(),
      },
    });
  })
  .post('/password-reset', authGuard, zodValidator('json', PasswordResetSchema), async (c) => {
    const { sub, email } = c.var.jwt;
    const { currentPassword, password } = c.req.valid('json');

    const { token, value, valueExpiresAt } = await AuthServices.passwordReset(
      { currentPassword, password },
      sub,
      email,
      c.req.header('User-Agent') || null,
    );

    setCookie(c, CookieKey.RefreshToken, value, getCookieOptions(valueExpiresAt));

    return MyResponse.success({
      data: { token },
      headers: {
        'X-Refresh-Token': value,
        'X-Refresh-Token-Expires': valueExpiresAt.toISOString(),
      },
    });
  })
  .post('/logout', async (c) => {
    const cValue = getCookie(c, CookieKey.RefreshToken);

    await AuthServices.logout(cValue || c.req.header('Authorization-Refresh-Token'));

    deleteCookie(c, CookieKey.RefreshToken, getCookieOptions(new Date()));

    return MyResponse.NoContent();
  })
  .get('/me', authGuard, async (c) => {
    const user = await AuthServices.me(c.var.jwt.sub);

    return MyResponse.success({
      data: { user },
    });
  })
  .route('/sessions', sessionsRoute);
