import { defineConfig } from 'drizzle-kit';

import { env } from '@/config/env';

export default defineConfig({
  out: './src/db/drizzle',
  schema: './src/db/schema.ts',
  dialect: 'postgresql',
  dbCredentials: {
    url: `postgres://${env.DB_USER}:${env.DB_PASSWORD}@${env.DB_HOST}:${env.DB_PORT}/${env.DB_NAME}`,
  },
  casing: 'snake_case',
});
