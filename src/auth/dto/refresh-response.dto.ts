import { ApiProperty } from '@nestjs/swagger';

/**
 * Defines the response returned after a successful token refresh.
 * The new refresh token travels only in the HttpOnly cookie.
 */
export class RefreshResponseDto {
  /**
   * New JWT access token.
   */
  @ApiProperty({
    description: 'New JWT access token.',
    example: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...',
  })
  accessToken: string;
}