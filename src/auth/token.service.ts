import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { createHash, timingSafeEqual } from 'node:crypto';

import { REFRESH_TOKEN_TTL_SECONDS } from './constants/auth.constants';
import { TokenPayload } from './types/token-payload.type';
import { assertJwtSecrets } from './utils/auth-config.util';

/**
 * Creates and verifies the authentication tokens.
 *
 * Access tokens are signed with JWT_SECRET (configured in AuthModule,
 * short-lived). Refresh tokens are signed with the separate
 * JWT_REFRESH_SECRET and live REFRESH_TOKEN_TTL_SECONDS. The database
 * stores only the SHA-256 hash of the current refresh token.
 */
@Injectable()
export class TokenService {
  private readonly refreshSecret: string;

  /**
   * Validates the secrets at startup.
   *
   * @param jwtService Signs and verifies tokens.
   * @param configService Provides environment configuration.
   */
  constructor(
    private readonly jwtService: JwtService,
    configService: ConfigService,
  ) {
    assertJwtSecrets(configService);

    this.refreshSecret = configService.getOrThrow<string>('JWT_REFRESH_SECRET');
  }

  /**
   * Creates a short-lived access token.
   *
   * @param payload Token content.
   * @returns The signed token.
   */
  signAccessToken(payload: TokenPayload): Promise<string> {
    return this.jwtService.signAsync(payload);
  }

  /**
   * Creates a long-lived refresh token with its own secret.
   *
   * @param payload Token content.
   * @returns The signed token.
   */
  signRefreshToken(payload: TokenPayload): Promise<string> {
    return this.jwtService.signAsync(payload, {
      secret: this.refreshSecret,
      expiresIn: REFRESH_TOKEN_TTL_SECONDS,
    });
  }

  /**
   * Verifies the signature and the expiry of a refresh token.
   *
   * @param token The refresh token.
   * @returns The token content.
   * @throws UnauthorizedException If the token is invalid, expired, or has no session.
   */
  async verifyRefreshToken(token: string): Promise<TokenPayload> {
    let payload: TokenPayload;

    try {
      payload = await this.jwtService.verifyAsync<TokenPayload>(token, {
        secret: this.refreshSecret,
      });
    } catch {
      throw new UnauthorizedException('Invalid or expired refresh token.');
    }

    if (!payload.sid || !payload.sub) {
      throw new UnauthorizedException('Invalid refresh token.');
    }

    return payload;
  }

  /**
   * Creates the SHA-256 hash of a refresh token (what the database stores).
   *
   * @param token Raw refresh token.
   * @returns The hash in hexadecimal format.
   */
  hashRefreshToken(token: string): string {
    return createHash('sha256').update(token).digest('hex');
  }

  /**
   * Compares a refresh token with a stored hash in constant time, so the
   * comparison time reveals nothing about the hash.
   *
   * @param token The submitted refresh token.
   * @param storedHash The hash stored in the session.
   * @returns True if the token is the one the hash was made from.
   */
  matchesHash(token: string, storedHash: string): boolean {
    const submitted = Buffer.from(this.hashRefreshToken(token), 'hex');
    const stored = Buffer.from(storedHash, 'hex');

    return submitted.length === stored.length && timingSafeEqual(submitted, stored);
  }
}