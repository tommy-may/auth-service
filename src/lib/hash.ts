import { env } from '@/config/env';

type Pwd = {
  options: Bun.Password.AlgorithmLabel | Bun.Password.Argon2Algorithm | Bun.Password.BCryptAlgorithm;
  hash: (password: string) => Promise<string>;
  verify: (password: string, hash: string) => Promise<boolean>;
  verifyTAP: (password: string, hash?: string) => Promise<boolean>;
};

export const MyPassword: Pwd = {
  options: {
    algorithm: 'argon2id',
    memoryCost: 62_500, // 64MB in kibibytes
    timeCost: 3,
  },
  hash: (password: string) => Bun.password.hash(password, MyPassword.options),
  verify: (password: string, hash: string) => Bun.password.verify(password, hash).catch(() => false),
  // Timing Attack Prevention
  verifyTAP: (password: string, hash: string = env.DUMMY_HASH) => MyPassword.verify(password, hash),
};

export const hashValue = (value: string) => {
  const hasher = new Bun.CryptoHasher('sha256');
  hasher.update(value);

  return hasher.digest('hex');
};
