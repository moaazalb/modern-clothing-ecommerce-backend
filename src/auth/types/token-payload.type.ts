import { UserRole } from '../../users/entities/user.entity';

/**
 * Content of the access and refresh tokens.
 */
export interface TokenPayload {
  /**
   * Authenticated user's unique identifier.
   */
  sub: string;

  /**
   * User's email address at token creation time.
   */
  email: string;

  /**
   * User's role at token creation time (the real role is read from the
   * database on every request, so this value is informational only).
   */
  role: UserRole;

  /**
   * Authentication session identifier.
   */
  sid: string;
}