import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createHash, randomUUID, timingSafeEqual } from 'crypto';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { DataSource } from 'typeorm';

import { User } from '../users/entities/user.entity';
import { UsersService } from '../users/users.service';
import { UserResponseDto } from '../users/dto/user-response.dto';
import { LoginDto } from './dto/login.dto';
import { SessionsService } from '../sessions/sessions.service';

/**
 * Contains device information associated with a login request.
 */
interface LoginMetadata {
  userAgent: string | null;
  ipAddress: string | null;
}

/**
 * Authentication service.
 *
 * Handles user login, password verification,
 * and JWT access token generation.
 */
@Injectable()
export class AuthService {
  /**
   * Injects the required authentication dependencies.
   *
   * @param usersService Handles user database operations.
   * @param jwtService Handles JWT token generation.
   */
  constructor(
    private readonly usersService: UsersService,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
    private readonly dataSource: DataSource,
    private readonly sessionsService: SessionsService,
  ) {}

  /**
   * Authenticates a user using email and password.
   *
   * @param loginDto User login credentials.
   * @returns JWT access token and safe user information.
   * @throws UnauthorizedException If credentials are invalid
   * or the account is inactive.
   */
  async login(
    loginDto: LoginDto,
    metadata: LoginMetadata,
  ): Promise<{
    accessToken: string;
    refreshToken: string;
    user: UserResponseDto;
  }> {
    const email = loginDto.email.trim().toLowerCase();

    /**
     * Retrieves the user together with the password hash.
     */
    const user = await this.usersService.findByEmailForAuth(email);

    if (!user) {
      throw new UnauthorizedException('Invalid email or password.');
    }

    /**
     * Compares the submitted password with the stored hash.
     */
    const isPasswordValid = await bcrypt.compare(
      loginDto.password,
      user.password,
    );

    if (!isPasswordValid) {
      throw new UnauthorizedException('Invalid email or password.');
    }

    /**
     * Prevents inactive accounts from accessing the application.
     */
    if (!user.isActive) {
      throw new UnauthorizedException('This account is inactive.');
    }

    /**
     * Generates a unique identifier for this authentication session.
     */
    const sessionId = randomUUID();

    /**
     * Creates the JWT payload.
     *
     * The sub claim represents the authenticated user's ID.
     * The sid claim identifies the current authentication session.
     */
    const payload = {
      sub: user.id,
      email: user.email,
      role: user.role,
      sid: sessionId,
    };

    /**
     * Generates a short-lived access token.
     */
    const accessToken = await this.jwtService.signAsync(payload);

    /**
     * Generates a long-lived refresh token using a separate secret.
     */
    const refreshToken = await this.jwtService.signAsync(payload, {
      secret: this.configService.getOrThrow<string>('JWT_REFRESH_SECRET'),
      expiresIn: '7d',
    });

    /**
     * Hashes the refresh token before storing it in the database.
     */
    const refreshTokenHash = this.hashRefreshToken(refreshToken);

    /**
     * Calculates the refresh token expiration date.
     */
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

    /**
     * Creates a separate database session for this login.
     */
    await this.sessionsService.createSession(
      sessionId,
      user.id,
      refreshTokenHash,
      expiresAt,
      metadata.userAgent,
      metadata.ipAddress,
    );

    /**
     * Returns only public user information.
     */
    const userResponse: UserResponseDto = {
      id: user.id,
      firstName: user.firstName,
      lastName: user.lastName,
      email: user.email,
      avatar: user.avatar,
      role: user.role,
      isActive: user.isActive,
      createdAt: user.createdAt,
      updatedAt: user.updatedAt,
    };

    return {
      accessToken,
      refreshToken,
      user: userResponse,
    };
  }

  /**
   * Refreshes authentication tokens using a database transaction
   * and pessimistic write lock to prevent concurrent token reuse.
   *
   * @param refreshToken Current refresh token.
   * @returns Newly generated access and refresh tokens.
   * @throws UnauthorizedException If the refresh token is invalid or expired.
   */
  async refresh(refreshToken: string): Promise<{
    accessToken: string;
    refreshToken: string;
  }> {
    try {
      /**
       * Verifies the refresh token using its dedicated secret.
       */
      const payload = await this.jwtService.verifyAsync<{
        sub: string;
        email: string;
        role: string;
        sid: string;
      }>(refreshToken, {
        secret: this.configService.getOrThrow<string>('JWT_REFRESH_SECRET'),
      });

      if (!payload.sid) {
        throw new UnauthorizedException('Invalid refresh token.');
      }

      /**
       * Executes token validation and rotation inside one transaction.
       */
      return await this.dataSource.transaction(async (manager) => {
        /**
         * Retrieves and locks the session row to prevent concurrent refresh operations.
         */
        const session = await this.sessionsService.findSessionByIdForUpdate(
          payload.sid,
          manager,
        );

        if (
          !session ||
          session.userId !== payload.sub ||
          session.revokedAt ||
          session.expiresAt <= new Date() ||
          !session.refreshTokenHash
        ) {
          throw new UnauthorizedException('Invalid refresh token.');
        }

        const user = session.user;

        if (!user || !user.isActive) {
          throw new UnauthorizedException('Invalid refresh token.');
        }

        /**
         * Compares the submitted refresh token with the stored SHA-256 hash.
         */
        const submittedTokenHash = Buffer.from(
          this.hashRefreshToken(refreshToken),
          'hex',
        );

        const storedTokenHash = Buffer.from(session.refreshTokenHash, 'hex');

        const isTokenValid =
          submittedTokenHash.length === storedTokenHash.length &&
          timingSafeEqual(submittedTokenHash, storedTokenHash);

        if (!isTokenValid) {
          throw new UnauthorizedException('Invalid refresh token.');
        }

        /**
         * Creates a new JWT payload using current user information
         * while preserving the current session identifier.
         */
        const newPayload = {
          sub: user.id,
          email: user.email,
          role: user.role,
          sid: session.id,
        };

        /**
         * Generates a new access token.
         */
        const accessToken = await this.jwtService.signAsync(newPayload);

        /**
         * Generates a new refresh token.
         */
        const newRefreshToken = await this.jwtService.signAsync(newPayload, {
          secret: this.configService.getOrThrow<string>('JWT_REFRESH_SECRET'),
          expiresIn: '7d',
        });

        /**
         * Hashes the new refresh token before storing it.
         */
        const newRefreshTokenHash = this.hashRefreshToken(newRefreshToken);

        /**
         * Updates the refresh token hash within the current transaction.
         */
        await this.sessionsService.updateRefreshTokenHash(
          session.id,
          newRefreshTokenHash,
          manager,
        );

        return {
          accessToken,
          refreshToken: newRefreshToken,
        };
      });
    } catch (error) {
      /**
       * Prevents exposing token verification or database details.
       */
      if (error instanceof UnauthorizedException) {
        throw error;
      }

      throw new UnauthorizedException('Invalid or expired refresh token.');
    }
  }

  /**
   * Creates a SHA-256 hash of a refresh token.
   *
   * @param token Raw refresh token.
   * @returns SHA-256 hash in hexadecimal format.
   */
  private hashRefreshToken(token: string): string {
    return createHash('sha256').update(token).digest('hex');
  }

  /**
   * Logs out a user by invalidating their current authentication session.
   *
   * A pessimistic write lock prevents concurrent refresh/logout
   * operations from modifying the same session simultaneously.
   *
   * @param refreshToken - The refresh token to invalidate.
   * @returns A success message.
   * @throws UnauthorizedException if the refresh token is invalid or expired.
   */
  async logout(refreshToken: string): Promise<{ message: string }> {
    try {
      /**
       * Verifies the refresh token signature and expiration.
       */
      const payload = await this.jwtService.verifyAsync<{
        sub: string;
        sid: string;
      }>(refreshToken, {
        secret: this.configService.getOrThrow<string>('JWT_REFRESH_SECRET'),
      });

      if (!payload.sid) {
        throw new UnauthorizedException('Invalid refresh token.');
      }

      return await this.dataSource.transaction(async (manager) => {
        /**
         * Retrieves and locks the current session.
         */
        const session = await this.sessionsService.findSessionByIdForUpdate(
          payload.sid,
          manager,
        );

        if (
          !session ||
          session.userId !== payload.sub ||
          session.revokedAt ||
          session.expiresAt <= new Date() ||
          !session.refreshTokenHash
        ) {
          throw new UnauthorizedException('Invalid refresh token.');
        }

        /**
         * Hashes the submitted refresh token using SHA-256.
         */
        const submittedHashBuffer = Buffer.from(
          this.hashRefreshToken(refreshToken),
          'hex',
        );

        const storedHashBuffer = Buffer.from(session.refreshTokenHash, 'hex');

        /**
         * Compares hashes safely to prevent timing attacks.
         */
        const isTokenValid =
          storedHashBuffer.length === submittedHashBuffer.length &&
          timingSafeEqual(storedHashBuffer, submittedHashBuffer);

        if (!isTokenValid) {
          throw new UnauthorizedException('Invalid refresh token.');
        }

        /**
         * Revokes only the current authentication session.
         */
        await this.sessionsService.revokeSession(
          session.id,
          new Date(),
          manager,
        );

        return {
          message: 'Logged out successfully.',
        };
      });
    } catch (error) {
      if (error instanceof UnauthorizedException) {
        throw error;
      }

      throw new UnauthorizedException('Invalid refresh token.');
    }
  }
}
