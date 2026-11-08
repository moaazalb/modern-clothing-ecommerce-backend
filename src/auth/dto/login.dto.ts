import {
  IsEmail,
  IsNotEmpty,
  IsString,
  MaxLength,
  MinLength,
} from 'class-validator';

import { ApiProperty } from '@nestjs/swagger';

/**
 * Defines the credentials required to authenticate a user.
 *
 * Validates the email and password received from the client
 * during the login process.
 */
export class LoginDto {
  /**
   * User's registered email address.
   */
  @ApiProperty({
    description: 'Registered user email address.',
    example: 'moaaz@example.com',
  })
  @IsEmail()
  @MaxLength(255)
  email: string;

  /**
   * User's account password.
   */
  @ApiProperty({
    description: 'Account password.',
    example: 'StrongPass123',
    minLength: 8,
    maxLength: 72,
    format: 'password',
  })
  @IsString()
  @IsNotEmpty()
  @MinLength(8)
  @MaxLength(72)
  password: string;
}
