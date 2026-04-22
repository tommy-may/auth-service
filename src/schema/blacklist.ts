import { createInsertSchema } from 'drizzle-orm/zod';
import * as z from 'zod';

import { blacklist } from '@/db/schema';

export const NewBlacklistSchema = createInsertSchema(blacklist, {
  jti: z.uuidv7(),
});

export const UpdateBlacklistSchema = NewBlacklistSchema.partial();

export type Blacklist = typeof blacklist.$inferSelect;

export type NewBlacklist = z.infer<typeof NewBlacklistSchema>;
export type UpdateBlacklist = z.infer<typeof UpdateBlacklistSchema>;
