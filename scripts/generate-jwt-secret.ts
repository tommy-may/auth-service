/**
 * Run once to generate your jwt secret:
 * bun run jwt-secret:generate
 *
 * Copy the output into your .env file.
 */

import { generateRandomValue } from '@/lib/utils';

// eslint-disable-next-line no-console
console.log(`JWT_SECRET="${generateRandomValue(128)}"`);
