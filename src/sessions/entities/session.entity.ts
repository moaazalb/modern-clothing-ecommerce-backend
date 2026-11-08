import {
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
 */
@Entity('user_sessions')
@Index(['userId'])
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
   * SHA-256 hash of the refresh token.
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
