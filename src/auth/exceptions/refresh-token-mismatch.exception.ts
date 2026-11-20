import { UnauthorizedException } from '@nestjs/common';

/**
 * Thrown when a refresh token has a valid signature and belongs to an
 * active session, but is not the current token of that session (it was
 * already rotated).
 *
 * It looks like any other 401 to the client. It is a separate class so the
 * controller does NOT clear the cookie in this case: when two browser tabs
 * refresh at the same time, the losing request must not delete the new
 * cookie that the winning request just set.
 */
export class RefreshTokenMismatchException extends UnauthorizedException {
  constructor() {
    super('Invalid refresh token.');
  }
}