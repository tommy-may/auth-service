import { defineRelations } from 'drizzle-orm';
import * as pg from 'drizzle-orm/pg-core';

const helpers = {
  timestamps: {
    createdAt: pg.timestamp('created_at').notNull().defaultNow(),
    updatedAt: pg
      .timestamp('updated_at')
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
};

// Tables

export const users = pg.pgTable('users', {
  id: pg.uuid().primaryKey(),

  email: pg.varchar({ length: 255 }).notNull().unique(),
  password: pg.varchar({ length: 128 }).notNull(),

  ...helpers.timestamps,
});

export const sessions = pg.pgTable(
  'sessions',
  {
    id: pg.uuid().primaryKey(),
    userId: pg
      .uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),

    value: pg.varchar({ length: 128 }).notNull().unique(),
    valueExpiresAt: pg.timestamp('value_expires_at').notNull(),

    jti: pg.uuid().notNull(),
    jtiExpiresAt: pg.timestamp('jti_expires_at').notNull(),

    userAgent: pg.varchar('user_agent', { length: 512 }),

    ...helpers.timestamps,
  },
  (t) => [pg.index('idx_sessions_user_id').on(t.userId)],
);

export const blacklist = pg.pgTable(
  'blacklist',
  {
    jti: pg.uuid().primaryKey(),
    expiresAt: pg.timestamp('expires_at').notNull(),
  },
  (t) => [pg.index('idx_blacklist_expires_at').on(t.expiresAt)],
);

// Relations

export const relations = defineRelations({ users, sessions, blacklist }, (r) => ({
  users: {
    sessions: r.many.sessions(),
  },
  sessions: {
    user: r.one.users({
      from: r.sessions.userId,
      to: r.users.id,
    }),
  },
}));
