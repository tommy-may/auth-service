import { createInsertSchema } from 'drizzle-orm/zod';
import * as z from 'zod';

import { users } from '@/db/schema';

const PasswordSchema = z.string().min(8).max(128);

export const NewUserSchema = createInsertSchema(users, {
  id: z.uuidv7(),
  email: z.email().max(255),
  password: PasswordSchema,
}).omit({ createdAt: true, updatedAt: true });

export const UpdateUserSchema = NewUserSchema.omit({ id: true }).partial();

export const RegisterSchema = NewUserSchema.omit({ id: true });

export const LoginSchema = z.object({
  email: z.email(),
  password: z.string().max(512),
});

export const PasswordResetSchema = z.object({
  currentPassword: z.string(),
  password: PasswordSchema,
});

export type User = typeof users.$inferSelect;

export type NewUser = z.infer<typeof NewUserSchema>;
export type UpdateUser = z.infer<typeof UpdateUserSchema>;

export type RegisterSchemaType = z.infer<typeof RegisterSchema>;
export type LoginSchemaType = z.infer<typeof LoginSchema>;
export type PasswordResetSchemaType = z.infer<typeof PasswordResetSchema>;
