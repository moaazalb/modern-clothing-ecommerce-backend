import {
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';

import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';

import { UsersService } from '../../users/users.service';
import { UserResponseDto } from '../../users/dto/user-response.dto';
import { User } from '../../users/entities/user.entity';
import { SessionsService } from '../../sessions/sessions.service';

/**
 * Defines the structure of the JWT payload.
 */
interface JwtPayload {
  /**
   * Authenticated user's unique identifier.
   */
  sub: string;

  /**
   * User's email address.
   */
  email: string;

  /**
   * User's authorization role at token creation time.
   */
  role: User['role'];

  /**
   * Authentication session identifier.
   */
  sid: string;
}

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
   * Passport attaches the returned value to request.user.
   *
   * @param payload Decoded JWT payload.
   * @returns Authenticated user's public information.
   * @throws UnauthorizedException If the user or session is invalid.
   */
  async validate(
    payload: JwtPayload,
  ): Promise<UserResponseDto & { sid: string }> {
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
        ...user,
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
