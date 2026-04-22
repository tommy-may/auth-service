import type { SQL } from 'drizzle-orm';

import { lt } from 'drizzle-orm';

import type { NewSession } from '@/schema/session';
import type { NewUser } from '@/schema/user';

import { db } from '@/config/db';
import { uuidv7 } from '@/lib/utils';

import * as schema from './schema';

type Transaction = Parameters<Parameters<typeof db.transaction>[0]>[0];

export const PG_UNIQUE_VIOLATION = '23505';

export const Schema = {
  users: schema.users,
  sessions: schema.sessions,
  blacklist: schema.blacklist,
};

export const Repository = {
  _helpers: {
    invalidateSessions: (where: SQL<unknown> | undefined) => async (tx: Transaction) => {
      const sessions = await tx
        .select({ id: schema.sessions.id, jti: schema.sessions.jti, expiresAt: schema.sessions.jtiExpiresAt })
        .from(schema.sessions)
        .where(where);

      if (sessions.length === 0) return false;

      const blacklist = sessions.filter(({ expiresAt }) => expiresAt > new Date());

      if (blacklist.length > 0) {
        await tx
          .insert(schema.blacklist)
          .values(blacklist.map(({ jti, expiresAt }) => ({ jti, expiresAt })))
          .onConflictDoNothing();
      }

      await tx.delete(schema.sessions).where(where);

      return true;
    },
  },

  users: {
    insert: (value: Omit<NewUser, 'id'>) => db.insert(schema.users).values({ ...value, id: uuidv7() }),

    find: ((...config) => db.query.users.findFirst(...config)) as typeof db.query.users.findFirst,
  },

  sessions: {
    insert: (values: Omit<NewSession, 'id'>) => db.insert(schema.sessions).values({ ...values, id: uuidv7() }),

    find: ((...config) => db.query.sessions.findFirst(...config)) as typeof db.query.sessions.findFirst,
    findMany: ((...config) => db.query.sessions.findMany(...config)) as typeof db.query.sessions.findMany,

    // Deletes sessions whose refresh token has already expired.
    // Safe to call at any time — expired sessions can no longer be used to authenticate.
    cleanup: () => db.delete(schema.sessions).where(lt(schema.sessions.valueExpiresAt, new Date())),
  },

  blacklist: {
    find: ((...config) => db.query.blacklist.findFirst(...config)) as typeof db.query.blacklist.findFirst,

    validate: {
      jti: {
        invalid: async (jti: string) => {
          const res = await Repository.blacklist.find({
            where: { jti },
            columns: { jti: true },
          });

          return !!res;
        },
      },
    },

    // Deletes all blacklist entries whose access token has already expired.
    // Safe to call at any time — expired JTIs can no longer be presented as valid tokens.
    cleanup: () => db.delete(schema.blacklist).where(lt(schema.blacklist.expiresAt, new Date())),
  },
};
