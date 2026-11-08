import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';

import { Reflector } from '@nestjs/core';

import { UserRole } from '../../users/entities/user.entity';
import { ROLES_KEY } from '../decorators/roles.decorator';

/**
 * Defines the authenticated user's request information.
 */
interface AuthenticatedRequest {
  user?: {
    role: UserRole;
  };
}

/**
 * Authorization guard.
 *
 * Checks whether the authenticated user has one of
 * the roles required to access a route.
 */
@Injectable()
export class RolesGuard implements CanActivate {
  /**
   * Injects Reflector to read route role metadata.
   *
   * @param reflector Reads metadata attached to route handlers.
   */
  constructor(private readonly reflector: Reflector) {}

  /**
   * Determines whether the user has permission to access a route.
   *
   * @param context Current HTTP execution context.
   * @returns True if the user has an allowed role.
   */
  canActivate(context: ExecutionContext): boolean {
    /**
     * Retrieves the roles required by the current route.
     */
    const requiredRoles = this.reflector.getAllAndOverride<UserRole[]>(
      ROLES_KEY,
      [context.getHandler(), context.getClass()],
    );

    /**
     * Allows access when no specific roles are required.
     */
    if (!requiredRoles || requiredRoles.length === 0) {
      return true;
    }

    /**
     * Retrieves the authenticated user attached by JwtStrategy.
     */
    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();

    const user = request.user;

    /**
     * Allows access only when the user's role matches
     * one of the required roles.
     */
    return !!user && requiredRoles.includes(user.role);
  }
}
