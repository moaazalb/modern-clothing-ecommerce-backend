import {
  Check,
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';

import { User } from '../../users/entities/user.entity';

/**
 * Represents an individual user authentication session.
 *
 * Each session belongs to one user and stores its own
 * hashed refresh token.
 *
 * A user can have multiple active sessions across devices.
 *
 * The database guarantees that a revoked session holds no token hash.
 */
@Entity('user_sessions')
@Index(['userId'])
@Check(
  'chk_user_sessions_revoked_hashes',
  `"revokedAt" IS NULL OR ("refreshTokenHash" IS NULL AND "previousRefreshTokenHash" IS NULL)`,
)
export class Session {
  /**
   * Unique identifier for each session.
   * PostgreSQL generates this UUID automatically.
   */
  @PrimaryGeneratedColumn('uuid')
  id: string;

  /**
   * ID of the user who owns this session.
   */
  @Column({ type: 'uuid' })
  userId: string;

  /**
   * User who owns this authentication session.
   */
  @ManyToOne(() => User, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'userId' })
  user: User;

  /**
   * SHA-256 hash of the current refresh token.
   *
   * Null when the session has been revoked.
   * Never store the original refresh token in the database.
   */
  @Column({
    type: 'varchar',
    length: 64,
    nullable: true,
    select: false,
  })
  refreshTokenHash: string | null;

  /**
   * SHA-256 hash of the refresh token that was replaced by the last
   * rotation. It lets the refresh logic tell a harmless race between two
   * tabs from the reuse of a stolen token.
   *
   * Null before the first rotation and when the session has been revoked.
   */
  @Column({
    type: 'varchar',
    length: 64,
    nullable: true,
    select: false,
  })
  previousRefreshTokenHash: string | null;

  /**
   * Date and time of the last rotation of the refresh token.
   */
  @Column({ type: 'timestamptz', nullable: true })
  rotatedAt: Date | null;

  /**
   * Date and time when the session was last used to renew its tokens.
   * It starts at the creation time.
   */
  @Column({ type: 'timestamptz', default: () => 'now()' })
  lastUsedAt: Date;

  /**
   * Date and time when this session expires.
   */
  @Column({ type: 'timestamptz' })
  expiresAt: Date;

  /**
   * Date and time when this session was revoked.
   *
   * Null means the session has not been explicitly revoked.
   */
  @Column({ type: 'timestamptz', nullable: true })
  revokedAt: Date | null;

  /**
   * Browser or device information associated with this session.
   */
  @Column({ type: 'varchar', length: 500, nullable: true })
  userAgent: string | null;

  /**
   * IP address used when creating this session.
   */
  @Column({ type: 'varchar', length: 45, nullable: true })
  ipAddress: string | null;

  /**
   * Date and time when this session was created.
   */
  @CreateDateColumn({ type: 'timestamptz' })
  createdAt: Date;
}