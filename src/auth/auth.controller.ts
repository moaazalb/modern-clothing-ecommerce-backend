import {
  Body,
  Controller,
  Header,
  HttpCode,
  HttpStatus,
  Post,
  Req,
  Res,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  ApiBody,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
  ApiTooManyRequestsResponse,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';

import type { CookieOptions, Request, Response } from 'express';

import { AuthService } from './auth.service';
import {
  LOGIN_THROTTLE,
  REFRESH_THROTTLE,
  REFRESH_TOKEN_COOKIE,
  REFRESH_TOKEN_TTL_MS,
} from './constants/auth.constants';
import { LoginResponseDto } from './dto/login-response.dto';
import { LoginDto } from './dto/login.dto';
import { RefreshResponseDto } from './dto/refresh-response.dto';
import { RefreshTokenMismatchException } from './exceptions/refresh-token-mismatch.exception';

/**
 * Handles authentication endpoints.
 *
 * Access tokens are returned in the response body,
 * while refresh tokens are stored in HttpOnly cookies.
 */
@ApiTags('Authentication')
@Controller('auth')
export class AuthController {
  /**
   * Options used when setting the refresh token cookie.
   */
  private readonly setCookieOptions: CookieOptions;

  /**
   * Options used when clearing the refresh token cookie. They must not
   * contain maxAge: some Express versions let maxAge override the expiry
   * date, which would keep the cookie instead of deleting it.
   */
  private readonly clearCookieOptions: CookieOptions;

  /**
   * Builds the cookie options from the configuration.
   *
   * @param authService Authentication business logic.
   * @param configService Provides NODE_ENV (the cookie is Secure in production).
   */
  constructor(
    private readonly authService: AuthService,
    configService: ConfigService,
  ) {
    const baseOptions: CookieOptions = {
      httpOnly: true,
      secure: configService.get<string>('NODE_ENV') === 'production',
      sameSite: 'lax',
      path: '/auth',
    };

    this.setCookieOptions = { ...baseOptions, maxAge: REFRESH_TOKEN_TTL_MS };
    this.clearCookieOptions = baseOptions;
  }

  /**
   * Reads the refresh token from the cookie.
   *
   * @param request The request.
   * @returns The refresh token, or undefined when there is none.
   */
  private readRefreshToken(request: Request): string | undefined {
    const value = request.cookies?.[REFRESH_TOKEN_COOKIE] as unknown;

    return typeof value === 'string' && value.length > 0 ? value : undefined;
  }

  /**
   * Authenticates a user and creates a new session.
   *
   * The refresh token is stored in an HttpOnly cookie
   * and is never exposed in the response body.
   */
  @Post('login')
  @Throttle({ default: LOGIN_THROTTLE })
  @Header('Cache-Control', 'no-store')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Authenticate a user' })
  @ApiBody({ type: LoginDto })
  @ApiOkResponse({ type: LoginResponseDto })
  @ApiUnauthorizedResponse({ description: 'Invalid email or password.' })
  @ApiTooManyRequestsResponse({ description: 'Too many login attempts.' })
  async login(
    @Body() loginDto: LoginDto,
    @Req() request: Request,
    @Res({ passthrough: true }) response: Response,
  ) {
    const result = await this.authService.login(loginDto, {
      userAgent: request.get('user-agent') ?? null,
      ipAddress: request.ip ?? null,
    });

    response.cookie(
      REFRESH_TOKEN_COOKIE,
      result.refreshToken,
      this.setCookieOptions,
    );

    return {
      accessToken: result.accessToken,
      user: result.user,
    };
  }

  /**
   * Renews authentication tokens using the refresh token cookie.
   *
   * The refresh token is rotated and the new token replaces the previous
   * cookie. When the token was used right after a rotation (two tabs
   * refreshing together), only a new access token is returned and the
   * cookie is left alone. The cookie is cleared only when the session is
   * definitely not valid (missing, expired, revoked, or a detected theft).
   */
  @Post('refresh')
  @Throttle({ default: REFRESH_THROTTLE })
  @Header('Cache-Control', 'no-store')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Refresh authentication tokens' })
  @ApiOkResponse({ type: RefreshResponseDto })
  @ApiUnauthorizedResponse({
    description: 'The refresh token is missing, invalid, expired or revoked.',
  })
  @ApiTooManyRequestsResponse({ description: 'Too many refresh attempts.' })
  async refresh(
    @Req() request: Request,
    @Res({ passthrough: true }) response: Response,
  ): Promise<RefreshResponseDto> {
    const refreshToken = this.readRefreshToken(request);

    if (!refreshToken) {
      response.clearCookie(REFRESH_TOKEN_COOKIE, this.clearCookieOptions);

      throw new UnauthorizedException('Refresh token is missing.');
    }

    try {
      const result = await this.authService.refresh(refreshToken);

      if (result.refreshToken) {
        response.cookie(
          REFRESH_TOKEN_COOKIE,
          result.refreshToken,
          this.setCookieOptions,
        );
      }

      return { accessToken: result.accessToken };
    } catch (error) {
      if (
        error instanceof UnauthorizedException &&
        !(error instanceof RefreshTokenMismatchException)
      ) {
        response.clearCookie(REFRESH_TOKEN_COOKIE, this.clearCookieOptions);
      }

      throw error;
    }
  }

  /**
   * Logs out the current authentication session.
   *
   * The refresh token cookie is always cleared, and the call always
   * succeeds, even if the token is missing, expired or invalid.
   */
  @Post('logout')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Log out the current session' })
  @ApiOkResponse({
    schema: {
      example: {
        message: 'Logged out successfully.',
      },
    },
  })
  async logout(
    @Req() request: Request,
    @Res({ passthrough: true }) response: Response,
  ): Promise<{ message: string }> {
    const refreshToken = this.readRefreshToken(request);

    response.clearCookie(REFRESH_TOKEN_COOKIE, this.clearCookieOptions);

    if (!refreshToken) {
      return { message: 'Logged out successfully.' };
    }

    return this.authService.logout(refreshToken);
  }
}