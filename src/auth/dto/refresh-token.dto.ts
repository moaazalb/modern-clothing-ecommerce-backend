import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString } from 'class-validator';

/**
 * Defines the request body used to refresh authentication tokens.
 */
export class RefreshTokenDto {
  /**
   * Current refresh token issued during login.
   */
  @ApiProperty({
    description: 'Current JWT refresh token.',
    example: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...',
  })
  @IsString()
  @IsNotEmpty()
  refreshToken: string;
}
