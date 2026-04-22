import type { LoginSchemaType, PasswordResetSchemaType, RegisterSchemaType } from '@/schema/user';

import { HttpError, Status } from '#pkg/http-response';

import { Repository } from '@/db/repository';
import { hashValue, MyPassword } from '@/lib/hash';
import { generateRefreshToken, signAccessToken } from '@/lib/jwt';

import { AuthRepository } from './repository';

export const AuthServices = {
  _helpers: {
    issueTokens: async (userId: string, email: string) => {
      const [value, valueExpiresAt] = generateRefreshToken();
      const [token, jti, jtiExpiresAt] = await signAccessToken({ sub: userId, email });

      return {
        value,
        valueExpiresAt,
        token,
        jti,
        jtiExpiresAt,
      };
    },
  },

  register: async (value: RegisterSchemaType) => {
    const hashedPassword = await MyPassword.hash(value.password);
    const user = await AuthRepository.register({ ...value, password: hashedPassword });

    return user;
  },

  login: async ({ email, password }: LoginSchemaType, userAgent: string | null) => {
    const user = await Repository.users.find({
      where: { email },
      columns: { id: true, email: true, password: true },
    });

    const verify = await MyPassword.verifyTAP(password, user?.password);

    if (!user || !verify) {
      throw new HttpError({
        code: 'INVALID_CREDENTIALS',
        status: Status.Unauthorized,
      });
    }

    const { value, valueExpiresAt, token, jti, jtiExpiresAt } = await AuthServices._helpers.issueTokens(user.id, email);

    await AuthRepository.login({
      userId: user.id,
      value: hashValue(value),
      valueExpiresAt,
      jti,
      jtiExpiresAt,
      userAgent,
    });

    return {
      token,
      value,
      valueExpiresAt,
    };
  },

  refresh: async (userAgent: string | null, currentRefreshToken?: string) => {
    if (!currentRefreshToken) {
      throw new HttpError({
        code: 'INVALID_REFRESH_TOKEN',
        status: Status.Unauthorized,
      });
    }

    const session = await Repository.sessions.find({
      where: { value: hashValue(currentRefreshToken) },
      columns: { id: true, valueExpiresAt: true, jti: true, jtiExpiresAt: true, userAgent: true },
      with: {
        user: {
          columns: { id: true, email: true },
        },
      },
    });

    if (!session || !session.user) {
      throw new HttpError({
        code: 'REFRESH_TOKEN_NOT_FOUND',
        status: Status.Forbidden,
      });
    }

    if (session.valueExpiresAt < new Date()) {
      throw new HttpError({
        code: 'REFRESH_TOKEN_EXPIRED',
        status: Status.Forbidden,
      });
    }

    const { value, valueExpiresAt, token, jti, jtiExpiresAt } = await AuthServices._helpers.issueTokens(
      session.user.id,
      session.user.email,
    );

    await AuthRepository.refresh(
      {
        blacklist: { jti: session.jti, expiresAt: session.jtiExpiresAt },
        values: { value: hashValue(value), valueExpiresAt, jti, jtiExpiresAt, userAgent },
      },
      session.id,
    );

    return {
      token,
      value,
      valueExpiresAt,
    };
  },

  passwordReset: async (
    { currentPassword, password }: PasswordResetSchemaType,
    id: string,
    email: string,
    userAgent: string | null,
  ) => {
    const user = await Repository.users.find({
      where: { id },
      columns: { password: true },
    });

    const verify = await MyPassword.verifyTAP(currentPassword, user?.password);

    if (!user || !verify) {
      throw new HttpError({
        message: 'Invalid credentials',
        code: 'INVALID_CREDENTIALS',
        status: Status.Unauthorized,
      });
    }

    const hashedPassword = await MyPassword.hash(password);

    const { value, valueExpiresAt, token, jti, jtiExpiresAt } = await AuthServices._helpers.issueTokens(id, email);

    await AuthRepository.passwordReset(hashedPassword, id, {
      userId: id,
      value: hashValue(value),
      valueExpiresAt,
      jti,
      jtiExpiresAt,
      userAgent,
    });

    return {
      token,
      value,
      valueExpiresAt,
    };
  },

  logout: async (currentRefreshToken?: string) => {
    if (!currentRefreshToken) return; // Silent logout

    await AuthRepository.logout(hashValue(currentRefreshToken));
  },

  me: async (id: string) => {
    const user = await Repository.users.find({
      where: { id },
      columns: { password: false },
    });

    if (!user) {
      throw new HttpError({
        message: `User with id \`${id}\` not found`,
        code: 'USER_NOT_FOUND',
        status: Status.Unauthorized,
      });
    }

    return user;
  },
};
