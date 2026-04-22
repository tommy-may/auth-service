import { createInsertSchema } from 'drizzle-orm/zod';
import * as z from 'zod';

import { sessions } from '@/db/schema';

export const NewSessionSchema = createInsertSchema(sessions, {
  id: z.uuidv7(),
  userId: z.uuidv7(),
  jti: z.uuidv7(),
  userAgent: z.string().max(512),
}).omit({ createdAt: true, updatedAt: true });

export const UpdateSessionSchema = NewSessionSchema.omit({ id: true, userId: true }).partial();

export type Session = typeof sessions.$inferSelect;

export type NewSession = z.infer<typeof NewSessionSchema>;
export type UpdateSession = z.infer<typeof UpdateSessionSchema>;
