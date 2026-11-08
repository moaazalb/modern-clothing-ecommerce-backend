import { SetMetadata } from '@nestjs/common';

import { UserRole } from '../../users/entities/user.entity';

/**
 * Metadata key used to identify the roles allowed to access a route.
 */
export const ROLES_KEY = 'roles';

/**
 * Defines the user roles allowed to access a route.
 *
 * @param roles Authorized user roles.
 * @returns A decorator that attaches role metadata to a route.
 */
export const Roles = (...roles: UserRole[]) => SetMetadata(ROLES_KEY, roles);
