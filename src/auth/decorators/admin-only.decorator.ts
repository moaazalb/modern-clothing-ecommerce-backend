import { applyDecorators, UseGuards } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiForbiddenResponse,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';

import { UserRole } from '../../users/entities/user.entity';
import { JwtAuthGuard } from '../guards/jwt-auth.guard';
import { RolesGuard } from '../guards/roles.guard';
import { Roles } from './roles.decorator';

/**
 * Restricts a controller or a route to authenticated administrators.
 *
 * RolesGuard lets a request through when a route has no @Roles metadata,
 * so every admin controller must use this decorator instead of combining
 * the guards by hand. It also documents the bearer scheme and the
 * 401/403 responses in Swagger.
 *
 * @returns A decorator that can be used on a class or a method.
 */
export function AdminOnly() {
  return applyDecorators(
    UseGuards(JwtAuthGuard, RolesGuard),
    Roles(UserRole.ADMIN),
    ApiBearerAuth('access-token'),
    ApiUnauthorizedResponse({
      description: 'Missing or invalid access token.',
    }),
    ApiForbiddenResponse({ description: 'The user is not an administrator.' }),
  );
}