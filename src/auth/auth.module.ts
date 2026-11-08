import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';

import { UsersModule } from '../users/users.module';
import { JwtStrategy } from './strategies/jwt.strategy';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { SessionsModule } from '../sessions/sessions.module';

/**
 * Authentication module.
 *
 * Responsible for user authentication and JWT token management.
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

    SessionsModule,

    /**
     * Configures JWT using environment variables.
     */
    JwtModule.registerAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => ({
        secret: configService.getOrThrow<string>('JWT_SECRET'),
        signOptions: {
          expiresIn: '15m',
        },
      }),
    }),
  ],
  controllers: [AuthController],
  providers: [AuthService, JwtStrategy],
  exports: [AuthService],
})
export class AuthModule {}
