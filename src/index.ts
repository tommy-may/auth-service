import '@/config/env';

import app from './app';
import { startCleanup } from './lib/cleanup';

const stopCleanup = startCleanup();

export default app;

process.on('SIGTERM', () => {
  stopCleanup();

  process.exit(0);
});
