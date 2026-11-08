import {
  Controller,
  Delete,
  Get,
  NotFoundException,
  Param,
  Req,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth } from '@nestjs/swagger';

import { AuthGuard } from '@nestjs/passport';
import type { Request } from 'express';

import { UserResponseDto } from '../users/dto/user-response.dto';
import { SessionsService } from './sessions.service';

/**
 * Defines the structure of an authenticated request.
 */
type AuthenticatedRequest = Request & {
  user: UserResponseDto & {
    sid: string;
  };
};

/**
 * Handles authentication session management endpoints.
 *
 * All endpoints require a valid access token
 * associated with an active authentication session.
 */
@ApiBearerAuth('access-token')
@Controller('sessions')
@UseGuards(AuthGuard('jwt'))
export class SessionsController {
  /**
   * Injects the required session management service.
   *
   * @param sessionsService Handles authentication sessions.
   */
  constructor(private readonly sessionsService: SessionsService) {}

  /**
   * Retrieves all active sessions belonging to the authenticated user.
   *
   * @param request Authenticated HTTP request.
   * @returns Active sessions with their current session indicator.
   */
  @Get()
  async findMySessions(@Req() request: AuthenticatedRequest) {
    const sessions = await this.sessionsService.findActiveSessions(
      request.user.id,
    );

    return {
      sessions: sessions.map((session) => ({
        id: session.id,
        userAgent: session.userAgent,
        ipAddress: session.ipAddress,
        createdAt: session.createdAt,
        expiresAt: session.expiresAt,
        isCurrent: session.id === request.user.sid,
      })),
    };
  }

  /**
   * Revokes a specific authentication session belonging to the current user.
   *
   * @param sessionId Session identifier to revoke.
   * @param request Authenticated HTTP request.
   * @returns A success message.
   * @throws NotFoundException If the session does not exist or cannot be revoked.
   */
  @Delete(':id')
  async revokeSession(
    @Param('id') sessionId: string,
    @Req() request: AuthenticatedRequest,
  ): Promise<{ message: string }> {
    const revoked = await this.sessionsService.revokeUserSession(
      sessionId,
      request.user.id,
    );

    if (!revoked) {
      throw new NotFoundException('Session not found.');
    }

    return {
      message: 'Session revoked successfully.',
    };
  }

  /**
   * Revokes all active authentication sessions belonging to the current user.
   *
   * @param request Authenticated HTTP request.
   * @returns The number of revoked sessions.
   */
  @Delete()
  async revokeAllSessions(@Req() request: AuthenticatedRequest): Promise<{
    message: string;
    revokedCount: number;
  }> {
    const revokedCount = await this.sessionsService.revokeAllSessions(
      request.user.id,
    );

    return {
      message: 'All sessions revoked successfully.',
      revokedCount,
    };
  }
}
