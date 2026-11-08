import {
  IsEmail,
  IsNotEmpty,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
} from 'class-validator';

import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

/**
 * Defines the data required to create a new user.
 *
 * This DTO validates incoming user data and provides
 * Swagger documentation for the registration endpoint.
 */
export class CreateUserDto {
  /**
   * User's first name.
   */
  @ApiProperty({
    description: "User's first name.",
    example: 'Moaaz',
    maxLength: 100,
  })
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  firstName: string;

  /**
   * User's last name.
   */
  @ApiProperty({
    description: "User's last name.",
    example: 'Albari',
    maxLength: 100,
  })
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  lastName: string;

  /**
   * User's email address.
   */
  @ApiProperty({
    description: "User's email address.",
    example: 'moaaz@example.com',
    maxLength: 255,
  })
  @IsEmail()
  @MaxLength(255)
  email: string;

  /**
   * User's password.
   */
  @ApiProperty({
    description: 'Account password. Must contain at least 8 characters.',
    example: 'StrongPass123',
    minLength: 8,
    maxLength: 72,
    format: 'password',
  })
  @IsString()
  @MinLength(8)
  @MaxLength(72)
  password: string;

  /**
   * Optional URL of the user's profile image.
   */
  @ApiPropertyOptional({
    description: "URL of the user's profile image.",
    example: 'https://example.com/avatar.jpg',
    maxLength: 500,
  })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  avatar?: string;
}
