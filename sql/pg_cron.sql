CREATE EXTENSION IF NOT EXISTS pg_cron;

-- Grant permissions to the user
--- GRANT USAGE ON SCHEMA cron TO ${DB_USER};

-- Deletes all blacklist entries whose access token has already expired.
-- Safe to call at any time — expired JTIs can no longer be presented as valid tokens.

-- Access tokens live for 15 minutes, so running cleanup every 30 minutes
-- ensures the blacklist never accumulates more than ~2 windows of stale entries.
SELECT cron.schedule(
  'blacklist-cleanup',
  '*/30 * * * *',
  $$
    DELETE FROM blacklist
    WHERE expires_at < NOW();
  $$
);

-- Deletes sessions whose refresh token has already expired.
-- Safe to call at any time — expired sessions can no longer be used to authenticate.

-- Sessions expire after 7 days — daily cleanup at 3:00 am is more than sufficient.
SELECT cron.schedule(
  'sessions-cleanup',
  '0 3 * * *',
  $$
    DELETE FROM sessions
    WHERE value_expires_at < NOW();
  $$
);
