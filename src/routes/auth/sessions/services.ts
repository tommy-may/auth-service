import { HttpError, Status } from '#pkg/http-response';

import { Repository } from '@/db/repository';
import { hashValue } from '@/lib/hash';

import { SessionsRepository } from './repository';

export const SessionsServices = {
  read: async (userId: string) => {
    const sessions = await Repository.sessions.findMany({
      where: { userId },
      columns: { userId: false, value: false, jti: false },
      orderBy: { createdAt: 'desc' },
    });

    return sessions;
  },

  logout: async (userId: string, id: string) => {
    if (!(await SessionsRepository.logout(userId, id))) {
      throw new HttpError({
        message: `Session \`${id}\` not found`,
        code: 'SESSION_NOT_FOUND',
        status: Status.NotFound,
      });
    }
  },

  invalidate: async (keepCurrent: boolean, userId: string, currentRefreshToken?: string) => {
    let exceptId: string | undefined;

    if (keepCurrent && currentRefreshToken) {
      const session = await Repository.sessions.find({
        where: { value: hashValue(currentRefreshToken) },
        columns: { id: true },
      });

      exceptId = session?.id;
    }

    await SessionsRepository.invalidate(userId, exceptId);
  },
};
