/**
 * Default maximum number of active sessions per user.
 * Override it with MAX_ACTIVE_SESSIONS.
 */
export const DEFAULT_MAX_ACTIVE_SESSIONS = 10;

/**
 * How many days an expired or revoked session is kept before the cleanup
 * deletes it. The kept rows are the audit history of recent logins.
 */
export const SESSION_RETENTION_DAYS = 30;

/**
 * Number of sessions deleted per statement by the cleanup.
 */
export const SESSION_CLEANUP_BATCH_SIZE = 500;