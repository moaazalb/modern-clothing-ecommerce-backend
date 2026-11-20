import { Injectable, Logger, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as bcrypt from 'bcrypt';
import { randomUUID } from 'node:crypto';
import { DataSource, EntityManager } from 'typeorm';

import { SessionsService } from '../sessions/sessions.service';
import { UserResponseDto } from '../users/dto/user-response.dto';
import { User } from '../users/entities/user.entity';
import { UsersService } from '../users/users.service';
import {
  BCRYPT_ROUNDS,
  MAX_IP_ADDRESS_LENGTH,
  MAX_USER_AGENT_LENGTH,
  REFRESH_REUSE_GRACE_SECONDS,
  REFRESH_TOKEN_TTL_MS,
} from './constants/auth.constants';
import { LoginDto } from './dto/login.dto';
import { RefreshTokenMismatchException } from './exceptions/refresh-token-mismatch.exception';
import { TokenService } from './token.service';
import { TokenPayload } from './types/token-payload.type';
import { readMaxActiveSessions } from './utils/auth-config.util';

/**
 * Contains device information associated with a login request.
 */
interface LoginMetadata {
  userAgent: string | null;
  ipAddress: string | null;
}

/**
 * Result of a successful login.
 */
interface LoginResult {
  accessToken: string;
  refreshToken: string;
  user: UserResponseDto;
}

/**
 * Result of a successful token refresh. refreshToken is null when only a
 * new access token was issued (the harmless two-tab race): the cookie must
 * then be left as it is.
 */
interface RefreshResult {
  accessToken: string;
  refreshToken: string | null;
}

/**
 * What a refresh transaction decided.
 *
 * rotated: the normal case, the refresh token was replaced.
 * grace: the previous token was used right after a rotation (two tabs).
 * reuse: the previous token was used too late: theft, the session was revoked.
 */
type RefreshOutcome =
  | { kind: 'rotated'; accessToken: string; refreshToken: string }
  | { kind: 'grace'; accessToken: string }
  | { kind: 'reuse' };

/**
 * Authentication service.
 *
 * Handles login, token refresh with rotation and theft detection, and
 * logout. Token details live in TokenService, session storage in
 * SessionsService, and the cookie in AuthController.
 */
@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  /**
   * A valid bcrypt hash of a random value, created once at startup.
   * When the email is unknown, the password is compared with it anyway, so
   * unknown and known emails take the same time to answer.
   */
  private readonly dummyPasswordHash = bcrypt.hashSync(
    randomUUID(),
    BCRYPT_ROUNDS,
  );

  private readonly maxActiveSessions: number;

  /**
   * Injects the required authentication dependencies.
   *
   * @param usersService Handles user database operations.
   * @param tokenService Creates and verifies tokens.
   * @param dataSource Opens the transactions used to create sessions and rotate tokens.
   * @param sessionsService Stores and reads authentication sessions.
   * @param configService Provides MAX_ACTIVE_SESSIONS.
   */
  constructor(
    private readonly usersService: UsersService,
    private readonly tokenService: TokenService,
    private readonly dataSource: DataSource,
    private readonly sessionsService: SessionsService,
    configService: ConfigService,
  ) {
    this.maxActiveSessions = readMaxActiveSessions(configService);
  }

  /**
   * Converts a User entity into the public user data.
   *
   * @param user User entity.
   * @returns Public user information (no password).
   */
  private toUserResponse(user: User): UserResponseDto {
    return {
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
  }

  /**
   * Builds the content of the tokens of a session.
   *
   * @param user The authenticated user.
   * @param sessionId Session identifier.
   * @returns The token payload.
   */
  private buildPayload(user: User, sessionId: string): TokenPayload {
    return {
      sub: user.id,
      email: user.email,
      role: user.role,
      sid: sessionId,
    };
  }

  /**
   * Cuts the device information to the stored sizes, so a very long
   * header can never make a login fail.
   *
   * @param metadata Device information from the request.
   * @returns The shortened device information.
   */
  private sanitizeMetadata(metadata: LoginMetadata): LoginMetadata {
    return {
      userAgent: metadata.userAgent
        ? metadata.userAgent.slice(0, MAX_USER_AGENT_LENGTH)
        : null,
      ipAddress: metadata.ipAddress
        ? metadata.ipAddress.slice(0, MAX_IP_ADDRESS_LENGTH)
        : null,
    };
  }

  /**
   * Authenticates a user using email and password and creates a session.
   *
   * The password is always compared with a hash (a dummy one when the
   * email is unknown), so the response time does not reveal which emails
   * are registered. When the user already has the maximum number of active
   * sessions, the oldest ones are revoked.
   *
   * @param loginDto User login credentials.
   * @param metadata Device information of the request.
   * @returns Access token, refresh token and safe user information.
   * @throws UnauthorizedException If credentials are invalid or the account is inactive.
   */
  async login(
    loginDto: LoginDto,
    metadata: LoginMetadata,
  ): Promise<LoginResult> {
    const email = loginDto.email.trim().toLowerCase();

    const user = await this.usersService.findByEmailForAuth(email);

    const isPasswordValid = await bcrypt.compare(
      loginDto.password,
      user?.password ?? this.dummyPasswordHash,
    );

    if (!user || !isPasswordValid) {
      throw new UnauthorizedException('Invalid email or password.');
    }

    /**
     * Prevents inactive accounts from accessing the application.
     */
    if (!user.isActive) {
      throw new UnauthorizedException('This account is inactive.');
    }

    const sessionId = randomUUID();
    const payload = this.buildPayload(user, sessionId);

    const accessToken = await this.tokenService.signAccessToken(payload);
    const refreshToken = await this.tokenService.signRefreshToken(payload);

    const { userAgent, ipAddress } = this.sanitizeMetadata(metadata);

    await this.dataSource.transaction(async (manager) => {
      await this.sessionsService.createSession(
        sessionId,
        user.id,
        this.tokenService.hashRefreshToken(refreshToken),
        new Date(Date.now() + REFRESH_TOKEN_TTL_MS),
        userAgent,
        ipAddress,
        manager,
      );

      await this.sessionsService.pruneExcessSessions(
        user.id,
        this.maxActiveSessions,
        manager,
      );
    });

    return { accessToken, refreshToken, user: this.toUserResponse(user) };
  }

  /**
   * Decides what to do with a refresh token, with the session row locked.
   *
   * - the token is the current one: rotate it;
   * - the token is the previous one and the rotation happened seconds ago: a harmless race, only a new access token is issued;
   * - the token is the previous one and the rotation is older: the token was stolen or replayed, the whole session is revoked;
   * - the token matches neither: it is simply refused.
   *
   * @param manager Entity manager of the running transaction.
   * @param payload The verified content of the refresh token.
   * @param refreshToken The submitted refresh token.
   * @returns What was decided (a revoked session is committed, not rolled back).
   * @throws UnauthorizedException If the session is missing, revoked, expired, or its user is inactive.
   * @throws RefreshTokenMismatchException If the token matches neither the current nor the previous one.
   */
  private async processRefresh(
    manager: EntityManager,
    payload: TokenPayload,
    refreshToken: string,
  ): Promise<RefreshOutcome> {
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
     * The new tokens use current user information and keep the session id.
     */
    const newPayload = this.buildPayload(user, session.id);

    if (this.tokenService.matchesHash(refreshToken, session.refreshTokenHash)) {
      const accessToken = await this.tokenService.signAccessToken(newPayload);
      const newRefreshToken =
        await this.tokenService.signRefreshToken(newPayload);

      await this.sessionsService.rotateRefreshToken(
        session.id,
        this.tokenService.hashRefreshToken(newRefreshToken),
        session.refreshTokenHash,
        manager,
      );

      return { kind: 'rotated', accessToken, refreshToken: newRefreshToken };
    }

    if (
      session.previousRefreshTokenHash &&
      session.rotatedAt &&
      this.tokenService.matchesHash(
        refreshToken,
        session.previousRefreshTokenHash,
      )
    ) {
      const ageMs = Date.now() - session.rotatedAt.getTime();

      if (ageMs <= REFRESH_REUSE_GRACE_SECONDS * 1000) {
        return {
          kind: 'grace',
          accessToken: await this.tokenService.signAccessToken(newPayload),
        };
      }

      await this.sessionsService.revokeSession(session.id, new Date(), manager);

      return { kind: 'reuse' };
    }

    throw new RefreshTokenMismatchException();
  }

  /**
   * Renews the tokens of a session. The refresh token is rotated: the new
   * one replaces the old one. Validation and rotation run in one
   * transaction with the session row locked, so two requests with the same
   * token can never both rotate it.
   *
   * @param refreshToken Current refresh token.
   * @returns The new access token, and the new refresh token (null when only the access token was issued).
   * @throws UnauthorizedException If the token or its session is not valid, or the token was stolen (the session is revoked).
   * @throws RefreshTokenMismatchException If the token is an old one that is neither the current nor the previous.
   */
  async refresh(refreshToken: string): Promise<RefreshResult> {
    const payload = await this.tokenService.verifyRefreshToken(refreshToken);

    const outcome = await this.dataSource.transaction((manager) =>
      this.processRefresh(manager, payload, refreshToken),
    );

    if (outcome.kind === 'reuse') {
      this.logger.warn(
        `Refresh token reuse detected: session ${payload.sid} of user ${payload.sub} was revoked.`,
      );

      throw new UnauthorizedException('Invalid refresh token.');
    }

    return {
      accessToken: outcome.accessToken,
      refreshToken: outcome.kind === 'rotated' ? outcome.refreshToken : null,
    };
  }

  /**
   * Logs out the session of a refresh token. Logging out is idempotent:
   * an invalid, expired or already revoked token also ends with success,
   * because the result the user wants (no session) is already true.
   *
   * A token with a valid signature revokes its session even if it is not
   * the current token (for example after a refresh in another tab).
   *
   * @param refreshToken The refresh token from the cookie.
   * @returns A success message.
   */
  async logout(refreshToken: string): Promise<{ message: string }> {
    try {
      const payload = await this.tokenService.verifyRefreshToken(refreshToken);

      await this.dataSource.transaction(async (manager) => {
        const session = await this.sessionsService.findSessionByIdForUpdate(
          payload.sid,
          manager,
        );

        if (session && session.userId === payload.sub && !session.revokedAt) {
          await this.sessionsService.revokeSession(
            session.id,
            new Date(),
            manager,
          );
        }
      });
    } catch (error) {
      if (!(error instanceof UnauthorizedException)) {
        throw error;
      }
    }

    return { message: 'Logged out successfully.' };
  }
}