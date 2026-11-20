import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, EntityManager, Repository } from 'typeorm';

import { Session } from './entities/session.entity';

/**
 * Sessions service.
 *
 * Stores and manages the authentication sessions. Every method that
 * revokes a session also clears both token hashes, which the database
 * requires for revoked sessions.
 */
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
   * @param manager Transaction-scoped entity manager (optional).
   * @returns The newly created authentication session.
   */
  async createSession(
    sessionId: string,
    userId: string,
    refreshTokenHash: string,
    expiresAt: Date,
    userAgent: string | null,
    ipAddress: string | null,
    manager?: EntityManager,
  ): Promise<Session> {
    const repository = manager
      ? manager.getRepository(Session)
      : this.sessionsRepository;

    const session = repository.create({
      id: sessionId,
      userId,
      refreshTokenHash,
      expiresAt,
      userAgent,
      ipAddress,
    });

    return repository.save(session);
  }

  /**
   * Finds an authentication session and locks its database row.
   *
   * The lock prevents concurrent requests from modifying
   * the same session simultaneously. Both token hashes are selected,
   * because the refresh logic needs the current and the previous one.
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
      .addSelect('session.previousRefreshTokenHash')
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
   * Rotates the refresh token of a session: the new hash becomes the
   * current one and the replaced hash is remembered as the previous one,
   * so that a stolen token can be told apart from a harmless race.
   *
   * @param sessionId - Unique identifier of the session.
   * @param newHash - SHA-256 hash of the new refresh token.
   * @param previousHash - SHA-256 hash of the token being replaced.
   * @param manager - Transaction-scoped entity manager.
   */
  async rotateRefreshToken(
    sessionId: string,
    newHash: string,
    previousHash: string,
    manager: EntityManager,
  ): Promise<void> {
    const now = new Date();

    await manager.getRepository(Session).update(sessionId, {
      refreshTokenHash: newHash,
      previousRefreshTokenHash: previousHash,
      rotatedAt: now,
      lastUsedAt: now,
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
      previousRefreshTokenHash: null,
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
        previousRefreshTokenHash: null,
      })
      .where('"userId" = :userId', { userId })
      .andWhere('"revokedAt" IS NULL')
      .andWhere('"expiresAt" > :now', { now: new Date() })
      .execute();

    return result.affected ?? 0;
  }

  /**
   * Revokes every active session of a user except one. It is used after a
   * password or email change: the device that made the change stays
   * logged in, every other device must log in again.
   *
   * @param userId - ID of the user.
   * @param keepSessionId - Session to keep (omit to revoke all of them).
   * @param manager - Transaction-scoped entity manager (optional).
   * @returns The number of revoked sessions.
   */
  async revokeOtherSessions(
    userId: string,
    keepSessionId: string | undefined,
    manager?: EntityManager,
  ): Promise<number> {
    const repository = manager
      ? manager.getRepository(Session)
      : this.sessionsRepository;

    const query = repository
      .createQueryBuilder()
      .update(Session)
      .set({
        revokedAt: new Date(),
        refreshTokenHash: null,
        previousRefreshTokenHash: null,
      })
      .where('"userId" = :userId', { userId })
      .andWhere('"revokedAt" IS NULL')
      .andWhere('"expiresAt" > :now', { now: new Date() });

    if (keepSessionId) {
      query.andWhere('"id" <> :keepSessionId', { keepSessionId });
    }

    const result = await query.execute();

    return result.affected ?? 0;
  }

  /**
   * Revokes the oldest active sessions of a user beyond a limit, keeping
   * the newest ones. It runs right after a login creates a new session.
   *
   * @param userId - ID of the user.
   * @param maxActive - Number of sessions to keep.
   * @param manager - Transaction-scoped entity manager.
   * @returns The number of revoked sessions.
   */
  async pruneExcessSessions(
    userId: string,
    maxActive: number,
    manager: EntityManager,
  ): Promise<number> {
    const excess: { id: string }[] = await manager.query(
      `SELECT "id" FROM "user_sessions"
       WHERE "userId" = $1 AND "revokedAt" IS NULL AND "expiresAt" > now()
       ORDER BY "createdAt" DESC, "id" DESC
       OFFSET $2`,
      [userId, maxActive],
    );

    if (excess.length === 0) {
      return 0;
    }

    await manager.query(
      `UPDATE "user_sessions"
       SET "revokedAt" = now(), "refreshTokenHash" = NULL,
           "previousRefreshTokenHash" = NULL
       WHERE "id" = ANY($1::uuid[])`,
      [excess.map((row) => row.id)],
    );

    return excess.length;
  }

  /**
   * Deletes the sessions that expired, or were revoked, more than the
   * retention period ago. Rows are deleted in batches so the table is
   * never locked for long.
   *
   * @param retentionDays - How many days such a session is kept.
   * @param batchSize - Number of sessions deleted per statement.
   * @returns The total number of deleted sessions.
   */
  async deleteStaleSessions(
    retentionDays: number,
    batchSize: number,
  ): Promise<number> {
    let total = 0;

    for (let round = 0; round < 1000; round += 1) {
      const result: unknown = await this.dataSource.query(
        `DELETE FROM "user_sessions" WHERE "id" IN (
           SELECT "id" FROM "user_sessions"
           WHERE "expiresAt" < now() - make_interval(days => $1)
              OR ("revokedAt" IS NOT NULL
                  AND "revokedAt" < now() - make_interval(days => $1))
           LIMIT $2
         )`,
        [retentionDays, batchSize],
      );

      const deleted =
        Array.isArray(result) && typeof result[1] === 'number' ? result[1] : 0;

      total += deleted;

      if (deleted < batchSize) {
        break;
      }
    }

    return total;
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