import { ApiProperty } from '@nestjs/swagger';

import { UserResponseDto } from '../../users/dto/user-response.dto';

/**
 * Defines the response returned after successful authentication.
 *
 * Contains the JWT access token and safe user information.
 */
export class LoginResponseDto {
  /**
   * JWT access token used to authenticate future requests.
   */
  @ApiProperty({
    description: 'JWT access token.',
    example: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...',
  })
  accessToken: string;

  /**
   * Public information about the authenticated user.
   */
  @ApiProperty({
    description: 'Authenticated user information.',
    type: UserResponseDto,
  })
  user: UserResponseDto;
}
