import { and, eq, ne } from 'drizzle-orm';

import { db } from '@/config/db';
import { Repository, Schema } from '@/db/repository';

export const SessionsRepository = {
  logout: (userId: string, id: string) =>
    db.transaction(
      Repository._helpers.invalidateSessions(and(eq(Schema.sessions.id, id), eq(Schema.sessions.userId, userId))),
    ),

  // Invalidates all active sessions for a user.
  // If exceptId is provided, that session is preserved (useful for "logout all other devices").
  invalidate: (userId: string, exceptId?: string) =>
    db.transaction(
      Repository._helpers.invalidateSessions(
        exceptId
          ? and(eq(Schema.sessions.userId, userId), ne(Schema.sessions.id, exceptId))
          : eq(Schema.sessions.userId, userId),
      ),
    ),
};
