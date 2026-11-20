/**
 * Name of the cookie that carries the refresh token.
 */
export const REFRESH_TOKEN_COOKIE = 'refreshToken';

/**
 * Refresh token lifetime in seconds: 7 days.
 * The token, the database session and the cookie all use this value, so
 * they always expire together.
 */
export const REFRESH_TOKEN_TTL_SECONDS = 7 * 24 * 60 * 60;

/**
 * Refresh token lifetime in milliseconds.
 */
export const REFRESH_TOKEN_TTL_MS = REFRESH_TOKEN_TTL_SECONDS * 1000;

/**
 * For this many seconds after a rotation, the previous refresh token is
 * still recognized. A request that uses it in that window is a normal race
 * (two browser tabs refreshing together) and only gets a new access token.
 * After the window, using the previous token is treated as theft and the
 * whole session is revoked.
 */
export const REFRESH_REUSE_GRACE_SECONDS = 10;

/**
 * bcrypt cost used to hash passwords. It must match the cost used by
 * UsersService, because the dummy hash used by the login (to keep the
 * response time equal for unknown emails) must be as slow as a real one.
 */
export const BCRYPT_ROUNDS = 12;

/**
 * Minimum length of the JWT secrets.
 */
export const MIN_JWT_SECRET_LENGTH = 32;

/**
 * Maximum stored length of the User-Agent header of a login.
 */
export const MAX_USER_AGENT_LENGTH = 255;

/**
 * Maximum stored length of an IP address (the longest IPv6 text form).
 */
export const MAX_IP_ADDRESS_LENGTH = 45;

/**
 * Rate limit of POST /auth/login, per client address.
 */
export const LOGIN_THROTTLE = { limit: 10, ttl: 60_000 } as const;

/**
 * Rate limit of POST /auth/refresh, per client address.
 */
export const REFRESH_THROTTLE = { limit: 30, ttl: 60_000 } as const;