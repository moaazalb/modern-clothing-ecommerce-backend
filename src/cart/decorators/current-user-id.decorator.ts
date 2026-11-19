import {
  createParamDecorator,
  ExecutionContext,
  UnauthorizedException,
} from '@nestjs/common';

/**
 * Extracts the authenticated user's id from the request.
 *
 * JwtStrategy attaches the user to request.user. Use it only on routes
 * protected by JwtAuthGuard.
 */
export const CurrentUserId = createParamDecorator(
  (_data: unknown, context: ExecutionContext): string => {
    const request = context
      .switchToHttp()
      .getRequest<{ user?: { id?: string } }>();

    const id = request.user?.id;

    if (!id) {
      throw new UnauthorizedException('Invalid authentication token.');
    }

    return id;
  },
);