import {
  Column,
  CreateDateColumn,
  Entity,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

/**
 * Defines the available roles within the application.
 *
 * CUSTOMER: Regular store customer.
 * ADMIN: Administrator with access to management features.
 */
export enum UserRole {
  CUSTOMER = 'customer',
  ADMIN = 'admin',
}

/**
 * Represents a user account in the database.
 *
 * Each instance of this class corresponds to one record
 * in the users table.
 */
@Entity('users')
export class User {
  /**
   * Unique identifier for each user.
   * PostgreSQL generates this UUID automatically.
   */
  @PrimaryGeneratedColumn('uuid')
  id: string;

  /**
   * User's first name.
   */
  @Column({ type: 'varchar', length: 100 })
  firstName: string;

  /**
   * User's last name.
   */
  @Column({ type: 'varchar', length: 100 })
  lastName: string;

  /**
   * User's email address.
   * Must be unique across all user accounts.
   */
  @Column({ type: 'varchar', length: 255, unique: true })
  email: string;

  /**
   * Hashed user password.
   *
   * select: false prevents TypeORM from retrieving this field
   * automatically in normal queries.
   *
   * Important: Never store plain-text passwords.
   */
  @Column({ type: 'varchar', length: 255, select: false })
  password: string;


  /**
   * URL of the user's profile image.
   * Nullable because uploading a profile image is optional.
   */
  @Column({ type: 'varchar', length: 500, nullable: true })
  avatar: string | null;

  /**
   * User's authorization role.
   * New accounts receive the CUSTOMER role by default.
   */
  @Column({
    type: 'enum',
    enum: UserRole,
    default: UserRole.CUSTOMER,
  })
  role: UserRole;

  /**
   * Indicates whether the account is active.
   * New accounts are active by default.
   */
  @Column({ type: 'boolean', default: true })
  isActive: boolean;

  /**
   * Date and time when the user record was created.
   * TypeORM manages this field automatically.
   */
  @CreateDateColumn({ type: 'timestamptz' })
  createdAt: Date;

  /**
   * Date and time of the user's last update.
   * TypeORM updates this field automatically.
   */
  @UpdateDateColumn({ type: 'timestamptz' })
  updatedAt: Date;
}
