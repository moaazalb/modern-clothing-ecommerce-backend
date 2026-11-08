import {
  Body,
  Controller,
  HttpCode,
  HttpStatus,
  Post,
  Req,
} from '@nestjs/common';

import type { Request } from 'express';

import {
  ApiBadRequestResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';

import { AuthService } from './auth.service';
import { LoginDto } from './dto/login.dto';
import { LoginResponseDto } from './dto/login-response.dto';
import { RefreshTokenDto } from './dto/refresh-token.dto';

/**
 * Authentication controller.
 *
 * Handles HTTP requests related to user authentication.
 */
@ApiTags('Authentication')
@Controller('auth')
export class AuthController {
  /**
   * Injects AuthService to handle authentication logic.
   *
   * @param authService Service responsible for authentication.
   */
  constructor(private readonly authService: AuthService) {}

  /**
   * Authenticates a user and returns a JWT access token.
   *
   * POST /auth/login
   *
   * @param loginDto User login credentials.
   * @param request Incoming HTTP request containing device information.
   * @returns JWT access token and authenticated user information.
   */
  @Post('login')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'User login',
    description: 'Authenticates a user using email and password.',
  })
  @ApiOkResponse({
    description: 'User authenticated successfully.',
    type: LoginResponseDto,
  })
  @ApiBadRequestResponse({
    description: 'Invalid login data.',
  })
  @ApiUnauthorizedResponse({
    description: 'Invalid credentials or inactive account.',
  })
  login(
    @Body() loginDto: LoginDto,
    @Req() request: Request,
  ): Promise<LoginResponseDto> {
    return this.authService.login(loginDto, {
      userAgent: request.headers['user-agent'] ?? null,
      ipAddress: request.ip ?? null,
    });
  }

  /**
   * Refreshes authentication tokens.
   *
   * POST /auth/refresh
   *
   * @param refreshTokenDto Current refresh token.
   * @returns Newly generated access and refresh tokens.
   */
  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Refresh authentication tokens',
    description:
      'Generates new access and refresh tokens using a valid refresh token.',
  })
  @ApiOkResponse({
    description: 'Authentication tokens refreshed successfully.',
  })
  @ApiBadRequestResponse({
    description: 'Invalid request data.',
  })
  @ApiUnauthorizedResponse({
    description: 'Invalid, expired, or revoked refresh token.',
  })
  refresh(@Body() refreshTokenDto: RefreshTokenDto): Promise<{
    accessToken: string;
    refreshToken: string;
  }> {
    return this.authService.refresh(refreshTokenDto.refreshToken);
  }

  /**
   * Logs out the authenticated user.
   *
   * POST /auth/logout
   *
   * @param refreshTokenDto Current refresh token.
   * @returns Logout confirmation message.
   */
  @Post('logout')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Logout user',
    description: 'Revokes the current refresh token and logs out the user.',
  })
  @ApiOkResponse({
    description: 'User logged out successfully.',
  })
  @ApiBadRequestResponse({
    description: 'Invalid request data.',
  })
  @ApiUnauthorizedResponse({
    description: 'Invalid, expired, or already revoked refresh token.',
  })
  logout(
    @Body() refreshTokenDto: RefreshTokenDto,
  ): Promise<{ message: string }> {
    return this.authService.logout(refreshTokenDto.refreshToken);
  }
}
