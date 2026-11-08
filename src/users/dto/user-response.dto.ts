import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

import { UserRole } from '../entities/user.entity';

/**
 * Defines the public user information returned by the API.
 *
 * Sensitive fields such as passwords are intentionally excluded.
 */
export class UserResponseDto {
  /**
   * Unique user identifier.
   */
  @ApiProperty({
    description: 'Unique user identifier.',
    example: '550e8400-e29b-41d4-a716-446655440000',
  })
  id: string;

  /**
   * User's first name.
   */
  @ApiProperty({
    example: 'Moaaz',
  })
  firstName: string;

  /**
   * User's last name.
   */
  @ApiProperty({
    example: 'Albari',
  })
  lastName: string;

  /**
   * User's email address.
   */
  @ApiProperty({
    example: 'moaaz@example.com',
  })
  email: string;

  /**
   * Optional profile image URL.
   */
  @ApiPropertyOptional({
    example: 'https://example.com/avatar.jpg',
    nullable: true,
  })
  avatar: string | null;

  /**
   * User's authorization role.
   */
  @ApiProperty({
    enum: UserRole,
    example: UserRole.CUSTOMER,
  })
  role: UserRole;

  /**
   * Indicates whether the account is active.
   */
  @ApiProperty({
    example: true,
  })
  isActive: boolean;

  /**
   * Account creation date.
   */
  @ApiProperty({
    type: String,
    format: 'date-time',
  })
  createdAt: Date;

  /**
   * Last account update date.
   */
  @ApiProperty({
    type: String,
    format: 'date-time',
  })
  updatedAt: Date;
}
