import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, EntityManager, Repository } from 'typeorm';

import { Session } from './entities/session.entity';

@Injectable()
export class SessionsService {
  constructor(
    @InjectRepository(Session)
    private readonly sessionsRepository: Repository<Session>,
    private readonly dataSource: DataSource,
  ) {}

  /**
   * Creates a new authentication session for a user.
   *
   * @param sessionId Unique authentication session identifier.
   * @param userId ID of the user who owns the session.
   * @param refreshTokenHash SHA-256 hash of the refresh token.
   * @param expiresAt Session expiration date.
   * @param userAgent Browser and device information.
   * @param ipAddress IP address used during login.
   * @returns The newly created authentication session.
   */
  async createSession(
    sessionId: string,
    userId: string,
    refreshTokenHash: string,
    expiresAt: Date,
    userAgent: string | null,
    ipAddress: string | null,
  ): Promise<Session> {
    const session = this.sessionsRepository.create({
      id: sessionId,
      userId,
      refreshTokenHash,
      expiresAt,
      userAgent,
      ipAddress,
    });

    return this.sessionsRepository.save(session);
  }

  /**
   * Finds an authentication session and locks its database row.
   *
   * The lock prevents concurrent requests from modifying
   * the same session simultaneously.
   *
   * @param sessionId - Unique identifier of the session.
   * @param manager - Transaction-scoped entity manager.
   * @returns The session with its user, or null if not found.
   */
  async findSessionByIdForUpdate(
    sessionId: string,
    manager: EntityManager,
  ): Promise<Session | null> {
    return manager
      .getRepository(Session)
      .createQueryBuilder('session')
      .setLock('pessimistic_write')
      .addSelect('session.refreshTokenHash')
      .innerJoinAndSelect('session.user', 'user')
      .where('session.id = :sessionId', { sessionId })
      .getOne();
  }

  /**
   * Updates the refresh token hash of an authentication session.
   *
   * The update is executed within the provided transaction
   * to ensure atomic refresh token rotation.
   *
   * @param sessionId - Unique identifier of the session.
   * @param refreshTokenHash - New SHA-256 refresh token hash.
   * @param manager - Transaction-scoped entity manager.
   */
  async updateRefreshTokenHash(
    sessionId: string,
    refreshTokenHash: string,
    manager: EntityManager,
  ): Promise<void> {
    await manager.getRepository(Session).update(sessionId, {
      refreshTokenHash,
    });
  }

  /**
   * Revokes an authentication session.
   *
   * The session is marked as revoked instead of being deleted,
   * preserving its history for auditing purposes.
   *
   * @param sessionId - Unique identifier of the session.
   * @param revokedAt - Date and time when the session was revoked.
   * @param manager - Transaction-scoped entity manager.
   */
  async revokeSession(
    sessionId: string,
    revokedAt: Date,
    manager: EntityManager,
  ): Promise<void> {
    await manager.getRepository(Session).update(sessionId, {
      revokedAt,
      refreshTokenHash: null,
    });
  }

  /**
   * Retrieves all active authentication sessions for a user.
   *
   * A session is considered active when it has not been revoked
   * and its expiration date is still in the future.
   *
   * @param userId - ID of the user.
   * @returns A list of active sessions.
   */
  async findActiveSessions(userId: string): Promise<Session[]> {
    return this.sessionsRepository
      .createQueryBuilder('session')
      .where('session.userId = :userId', { userId })
      .andWhere('session.revokedAt IS NULL')
      .andWhere('session.expiresAt > :now', { now: new Date() })
      .orderBy('session.createdAt', 'DESC')
      .getMany();
  }

  /**
   * Revokes all active authentication sessions belonging to a user.
   *
   * All sessions are invalidated within a single database operation.
   *
   * @param userId - ID of the user.
   * @returns The number of revoked sessions.
   */
  async revokeAllSessions(userId: string): Promise<number> {
    const result = await this.sessionsRepository
      .createQueryBuilder()
      .update(Session)
      .set({
        revokedAt: new Date(),
        refreshTokenHash: null,
      })
      .where('"userId" = :userId', { userId })
      .andWhere('"revokedAt" IS NULL')
      .andWhere('"expiresAt" > :now', { now: new Date() })
      .execute();

    return result.affected ?? 0;
  }

  /**
   * Finds an active authentication session by its ID and owner.
   *
   * @param sessionId Unique authentication session identifier.
   * @param userId ID of the user who owns the session.
   * @returns The active session or null if it does not exist.
   */
  async findActiveSession(
    sessionId: string,
    userId: string,
  ): Promise<Session | null> {
    return this.sessionsRepository
      .createQueryBuilder('session')
      .where('session.id = :sessionId', { sessionId })
      .andWhere('session.userId = :userId', { userId })
      .andWhere('session.revokedAt IS NULL')
      .andWhere('session.expiresAt > :now', { now: new Date() })
      .getOne();
  }

  /**
   * Revokes an authentication session belonging to a specific user.
   *
   * A transaction and pessimistic write lock prevent concurrent
   * refresh and revocation operations from modifying the same session.
   *
   * @param sessionId Unique authentication session identifier.
   * @param userId ID of the user who owns the session.
   * @returns True if the session was revoked.
   */
  async revokeUserSession(sessionId: string, userId: string): Promise<boolean> {
    return this.dataSource.transaction(async (manager) => {
      /**
       * Retrieves and locks the requested session.
       */
      const session = await this.findSessionByIdForUpdate(sessionId, manager);

      if (
        !session ||
        session.userId !== userId ||
        session.revokedAt ||
        session.expiresAt <= new Date()
      ) {
        return false;
      }

      /**
       * Revokes the session and invalidates its refresh token.
       */
      await this.revokeSession(session.id, new Date(), manager);

      return true;
    });
  }
}
