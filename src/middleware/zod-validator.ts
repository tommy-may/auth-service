import type { ValidationTargets } from 'hono';
import type * as z from 'zod';

import { validator } from 'hono/validator';

import { HttpError } from '#pkg/http-response';

export const zodValidator = <T extends keyof ValidationTargets, S extends z.ZodType>(target: T, schema: S) =>
  validator(target, async (value) => {
    const parsed = await schema.safeParseAsync(value);
    if (!parsed.success) {
      throw HttpError.BadRequest(parsed.error.message, parsed.error.issues);
    }

    return parsed.data;
  });
