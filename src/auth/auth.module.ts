import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import type { StringValue } from 'ms';

import { SessionsModule } from '../sessions/sessions.module';
import { UsersModule } from '../users/users.module';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { JwtStrategy } from './strategies/jwt.strategy';
import { TokenService } from './token.service';

/**
 * Authentication module.
 *
 * Responsible for user authentication, JWT tokens and sessions.
 */
@Module({
  imports: [
    /**
     * Provides access to user-related database operations.
     */
    UsersModule,

    /**
     * Configures Passport authentication.
     */
    PassportModule,

    /**
     * Stores the authentication sessions.
     */
    SessionsModule,

    /**
     * Configures access token signing using environment variables.
     * The refresh token uses its own secret inside TokenService.
     */
    JwtModule.registerAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => ({
        secret: configService.getOrThrow<string>('JWT_SECRET'),
        signOptions: {
          expiresIn: (configService.get<string>('JWT_EXPIRES_IN') ??
            '15m') as StringValue,
        },
      }),
    }),
  ],
  controllers: [AuthController],
  providers: [AuthService, TokenService, JwtStrategy],
  exports: [AuthService],
})
export class AuthModule {}