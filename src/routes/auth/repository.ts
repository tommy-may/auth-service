import { and, asc, eq } from 'drizzle-orm';

import type { Blacklist } from '@/schema/blacklist';
import type { NewSession, UpdateSession } from '@/schema/session';
import type { RegisterSchemaType } from '@/schema/user';

import { HttpError, Status } from '#pkg/http-response';

import { db } from '@/config/db';
import { PG_UNIQUE_VIOLATION, Repository, Schema } from '@/db/repository';
import { uuidv7 } from '@/lib/utils';

// Maximum number of concurrent active sessions per user.
// On login, if the limit is reached the oldest session is evicted automatically.
const MAX_SESSIONS = 5;

export const AuthRepository = {
  register: async (value: RegisterSchemaType) => {
    try {
      const [user] = await Repository.users.insert(value).returning();
      const { password: _, ...userWithoutPassword } = user!;

      return userWithoutPassword;
    } catch (e) {
      // Race Condition
      if ((e as { cause: { code: string } })?.cause?.code === PG_UNIQUE_VIOLATION) {
        throw new HttpError({
          message: `Email \`${value.email}\` is already in use`,
          code: 'EMAIL_TAKEN',
          status: Status.Conflict,
        });
      }

      throw e;
    }
  },

  login: (values: Omit<NewSession, 'id'>) =>
    db.transaction(async (tx) => {
      const sessions = await tx
        .select({ id: Schema.sessions.id, createdAt: Schema.sessions.createdAt })
        .from(Schema.sessions)
        .where(eq(Schema.sessions.userId, values.userId))
        .orderBy(asc(Schema.sessions.createdAt));

      // Evict the oldest session if the user has reached the limit.
      if (sessions.length >= MAX_SESSIONS) {
        await Repository._helpers.invalidateSessions(
          and(eq(Schema.sessions.id, sessions[0]!.id), eq(Schema.sessions.userId, values.userId)),
        )(tx);
      }

      await tx.insert(Schema.sessions).values({ ...values, id: uuidv7() });
    }),

  refresh: ({ blacklist, values }: { blacklist: Blacklist; values: UpdateSession }, id: string) =>
    db.transaction(async (tx) => {
      await tx.insert(Schema.blacklist).values(blacklist).onConflictDoNothing();
      await tx.update(Schema.sessions).set(values).where(eq(Schema.sessions.id, id));
    }),

  passwordReset: (password: string, id: string, values: Omit<NewSession, 'id'>) =>
    db.transaction(async (tx) => {
      await tx.update(Schema.users).set({ password }).where(eq(Schema.users.id, id));

      await Repository._helpers.invalidateSessions(eq(Schema.sessions.userId, id))(tx);

      // Insert the new session in the same transaction so that
      // password reset, session invalidation and session creation
      // are all atomic: the user is never left without a valid session.
      await tx.insert(Schema.sessions).values({ ...values, id: uuidv7() });
    }),

  logout: (value: string) => db.transaction(Repository._helpers.invalidateSessions(eq(Schema.sessions.value, value))),
};
