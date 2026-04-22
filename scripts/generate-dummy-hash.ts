/**
 * Run once to generate your dummy hash:
 * bun run dummy-hash:generate
 *
 * Copy the output into your .env file.
 */

import { MyPassword } from '@/lib/hash';

const escapeDollar = (input: string) => input.replace(/\$/g, '\\$');

const hash = await MyPassword.hash('password');

// eslint-disable-next-line no-console
console.log(`DUMMY_HASH="${escapeDollar(hash)}"`);
