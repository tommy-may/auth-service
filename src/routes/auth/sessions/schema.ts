import * as z from 'zod';

export const DeleteByIdParamSchema = z.object({
  id: z.uuidv7(),
});

// ?keep_current=true → "logout all other devices", current session is preserved.
export const DeleteQuerySchema = z.object({
  keep_current: z.coerce.boolean().default(false),
});
