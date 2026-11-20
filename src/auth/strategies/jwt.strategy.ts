import {
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';

import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';

import { SessionsService } from '../../sessions/sessions.service';
import { UsersService } from '../../users/users.service';
import { AuthenticatedUser } from '../types/authenticated-user.type';
import { TokenPayload } from '../types/token-payload.type';

/**
 * JWT authentication strategy.
 *
 * Extracts JWT tokens from incoming requests,
 * verifies their signature and expiration,
 * and retrieves the authenticated user.
 */
@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  /**
   * Configures JWT verification and injects required services.
   *
   * @param configService Provides environment configuration.
   * @param usersService Retrieves user information.
   * @param sessionsService Validates authentication sessions.
   */
  constructor(
    configService: ConfigService,
    private readonly usersService: UsersService,
    private readonly sessionsService: SessionsService,
  ) {
    super({
      /**
       * Extracts the token from the Authorization header.
       *
       * Expected format: Bearer <token>
       */
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),

      /**
       * Rejects expired tokens.
       */
      ignoreExpiration: false,

      /**
       * Secret used to verify the JWT signature.
       */
      secretOrKey: configService.getOrThrow<string>('JWT_SECRET'),
    });
  }

  /**
   * Validates the JWT payload after signature verification.
   *
   * The session and the user are read from the database on every request,
   * so a revoked session, a disabled account or a changed role takes
   * effect immediately, even for an access token that has not expired.
   * Passport attaches the returned value to request.user.
   *
   * @param payload Decoded JWT payload.
   * @returns Authenticated user's public information and the session id.
   * @throws UnauthorizedException If the user or session is invalid.
   */
  async validate(payload: TokenPayload): Promise<AuthenticatedUser> {
    try {
      if (!payload.sid) {
        throw new UnauthorizedException('Invalid authentication token.');
      }

      /**
       * Verifies that the authentication session is still active.
       */
      const session = await this.sessionsService.findActiveSession(
        payload.sid,
        payload.sub,
      );

      if (!session) {
        throw new UnauthorizedException('Invalid or expired session.');
      }

      /**
       * Retrieves the authenticated user.
       */
      const user = await this.usersService.findOne(payload.sub);

      if (!user.isActive) {
        throw new UnauthorizedException('This account is inactive.');
      }

      return {
        id: user.id,
        firstName: user.firstName,
        lastName: user.lastName,
        email: user.email,
        avatar: user.avatar,
        role: user.role,
        isActive: user.isActive,
        createdAt: user.createdAt,
        updatedAt: user.updatedAt,
        sid: payload.sid,
      };
    } catch (error) {
      if (error instanceof NotFoundException) {
        throw new UnauthorizedException('Invalid authentication token.');
      }

      throw error;
    }
  }
}