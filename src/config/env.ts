import * as z from 'zod';

import { type Env, EnvSchema } from '@/schema/env';

const { data, error, success } = EnvSchema.safeParse(process.env);

const config = (): Env => {
  if (success) return data;

  const NODE_ENV = process.env.NODE_ENV || 'unknown';

  console.error(`Error parsing \`.env.${NODE_ENV}\` file:`);
  console.error(JSON.stringify(z.treeifyError(error).properties, undefined, 2));

  process.exit(1);
};

export const env = config();
