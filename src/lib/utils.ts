export const uuidv7 = () => Bun.randomUUIDv7();

export const msToSeconds = (ms: number) => Math.round(ms / 1000);

export const generateRandomValue = (length = 64) =>
  Buffer.from(crypto.getRandomValues(new Uint8Array(length))).toString('base64url');
