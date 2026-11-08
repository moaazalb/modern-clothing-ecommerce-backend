import { Injectable } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';

/**
 * JWT authentication guard.
 *
 * Protects routes by requiring a valid JWT access token.
 * Passport delegates token verification to JwtStrategy.
 */
@Injectable()
export class JwtAuthGuard extends AuthGuard('jwt') {}
