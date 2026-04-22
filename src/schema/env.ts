import * as z from 'zod';

/**
 * Wraps a Zod schema to handle optional environment variables with a default value.
 * Empty strings (`''`) are treated as `undefined`, triggering the default value to be used instead.
 *
 * @param schema - The Zod schema to wrap.
 * @param def - The default value to use when the variable is absent or an empty string.
 * @returns A preprocessed Zod schema that normalizes empty strings to `undefined` before applying the default.
 *
 * @example
 * const schema = optional(z.string(), 'localhost');
 * schema.parse(undefined);   // → 'localhost'
 * schema.parse('');          // → 'localhost'
 * schema.parse('hostname');  // → 'hostname'
 */
const optional = <S extends z.ZodType>(schema: S, def: z.core.util.NoUndefined<z.core.output<S>>) =>
  z.preprocess((v) => (v === '' ? undefined : v), schema.default(def));

const CommaSeparatedUrlSchema = z
  .string()
  .transform((v) =>
    v
      .split(',')
      .map((url) => url.trim())
      .filter(Boolean),
  )
  .pipe(z.array(z.url()));

export const EnvSchema = z.object({
  NODE_ENV: z.enum(['development', 'production']),
  PORT: optional(z.coerce.number().min(0).max(65_535), 3_000),
  ALLOWED_ORIGINS: optional(CommaSeparatedUrlSchema, ['http://localhost:5173']),
  DB_USER: z.string(),
  DB_PASSWORD: z.string(),
  DB_HOST: z.string(),
  DB_PORT: z.coerce.number().min(0).max(65_535),
  DB_NAME: z.string(),
  DUMMY_HASH: z.string().regex(/^\$argon2id\$v=\d+\$m=\d+,t=\d+,p=\d+\$[A-Za-z0-9+/]+={0,2}\$[A-Za-z0-9+/]+={0,2}$/),
  JWT_SECRET: z.base64url(),
});

export type Env = z.infer<typeof EnvSchema>;
