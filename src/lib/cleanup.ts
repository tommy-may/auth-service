import { Repository } from '@/db/repository';

// Access tokens live for 15 minutes, so running cleanup every 30 minutes
// ensures the blacklist never accumulates more than ~2 windows of stale entries.
const BLACKLIST_CLEANUP_MS = 1_800_000; // 30 minutes

// Sessions expire after 7 days — daily cleanup is more than sufficient.
const SESSION_CLEANUP_MS = 86_400_000; // 24 hours

export const cb = (label: string, fn: () => Promise<unknown>) => () => {
  void (async () => {
    await fn().catch((e) => console.error(`[${label}] Failed:`, e));
  })();
};

export const startCleanup = () => {
  const blacklistCb = cb('blacklist.cleanup', Repository.blacklist.cleanup);
  const sessionCb = cb('session.cleanup', Repository.sessions.cleanup);

  // Run once at startup to clear any leftovers from a previous process.
  void blacklistCb();
  void sessionCb();

  const ids = [setInterval(blacklistCb, BLACKLIST_CLEANUP_MS), setInterval(sessionCb, SESSION_CLEANUP_MS)];

  return () => ids.forEach(clearInterval);
};
