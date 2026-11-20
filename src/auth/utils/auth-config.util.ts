import { ConfigService } from '@nestjs/config';

import { DEFAULT_MAX_ACTIVE_SESSIONS } from '../../sessions/constants/session.constants';
import { MIN_JWT_SECRET_LENGTH } from '../constants/auth.constants';

/**
 * Checks the JWT secrets when the application starts.
 *
 * The two secrets must be long and different. If they were the same, a
 * refresh token (valid 7 days) would also be accepted as an access token.
 *
 * @param configService Provides environment configuration.
 * @throws Error If a secret is missing, too short, or both are equal (the app refuses to start).
 */
export function assertJwtSecrets(configService: ConfigService): void {
  const accessSecret = configService.getOrThrow<string>('JWT_SECRET');
  const refreshSecret = configService.getOrThrow<string>('JWT_REFRESH_SECRET');

  if (
    accessSecret.length < MIN_JWT_SECRET_LENGTH ||
    refreshSecret.length < MIN_JWT_SECRET_LENGTH
  ) {
    throw new Error(
      `JWT_SECRET and JWT_REFRESH_SECRET must be at least ${MIN_JWT_SECRET_LENGTH} characters long.`,
    );
  }

  if (accessSecret === refreshSecret) {
    throw new Error('JWT_SECRET and JWT_REFRESH_SECRET must be different.');
  }
}

/**
 * Reads MAX_ACTIVE_SESSIONS: how many sessions (devices) a user can keep
 * logged in at the same time. It must be a whole number between 1 and 100.
 *
 * @param configService Provides environment configuration.
 * @returns The maximum number of active sessions per user.
 * @throws Error If the configured value is invalid (the app refuses to start).
 */
export function readMaxActiveSessions(configService: ConfigService): number {
  const value = Number(
    configService.get<string>('MAX_ACTIVE_SESSIONS') ??
      DEFAULT_MAX_ACTIVE_SESSIONS,
  );

  if (!Number.isInteger(value) || value < 1 || value > 100) {
    throw new Error('MAX_ACTIVE_SESSIONS must be a whole number between 1 and 100.');
  }

  return value;
}