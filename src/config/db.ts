import { drizzle } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';

import { relations } from '@/db/schema';

import { env } from './env';

const client = new Pool({
  user: env.DB_USER,
  password: env.DB_PASSWORD,
  host: env.DB_HOST,
  port: env.DB_PORT,
  database: env.DB_NAME,
  // The 'statement_timeout' option sets the maximum amount of time (in milliseconds)
  // that a query can run before PostgreSQL automatically cancels it.
  // In this case, any query taking longer than 5000ms (5 seconds) will be terminated.
  // This helps prevent long-running queries from blocking the database or consuming too many resources.
  statement_timeout: 5_000,
});

export const db = drizzle({
  client,
  casing: 'snake_case',
  relations,
});
