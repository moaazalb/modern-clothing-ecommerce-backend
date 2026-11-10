import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsBoolean,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUrl,
  Matches,
  MaxLength,
} from 'class-validator';

import { SLUG_REGEX } from '../../../constants/product.constants';
import {
  ToLowerCase,
  Trim,
} from '../../../../common/transforms/string.transforms';

/**
 * Defines the data required to create a brand.
 */
export class CreateBrandDto {
  /**
   * Brand name. Unique ignoring letter case.
   */
  @ApiProperty({
    description: 'Brand name (unique, case-insensitive).',
    example: 'Nike',
    maxLength: 100,
  })
  @Trim()
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  name: string;

  /**
   * Optional URL slug. When omitted, the service generates it from the name.
   */
  @ApiPropertyOptional({
    description:
      'URL slug (lowercase letters, digits, hyphens). Generated from the name when omitted.',
    example: 'nike',
    maxLength: 120,
  })
  @IsOptional()
  @Trim()
  @ToLowerCase()
  @IsString()
  @MaxLength(120)
  @Matches(SLUG_REGEX, {
    message:
      'slug must contain lowercase letters, digits and single hyphens only.',
  })
  slug?: string;

  /**
   * Optional description.
   */
  @ApiPropertyOptional({
    description: 'Optional description. Send null on update to clear it.',
    nullable: true,
  })
  @IsOptional()
  @Trim()
  @IsString()
  @MaxLength(2000)
  description?: string | null;

  /**
   * Optional logo URL (https only).
   */
  @ApiPropertyOptional({
    description: 'Logo URL (https only). Send null on update to clear it.',
    example: 'https://example.com/logo.png',
    maxLength: 500,
    nullable: true,
  })
  @IsOptional()
  @Trim()
  @IsString()
  @MaxLength(500)
  @IsUrl({ protocols: ['https'], require_protocol: true })
  logoUrl?: string | null;

  /**
   * Optional official website URL (https only).
   */
  @ApiPropertyOptional({
    description: 'Official website (https only). Send null on update to clear it.',
    example: 'https://www.nike.com',
    maxLength: 500,
    nullable: true,
  })
  @IsOptional()
  @Trim()
  @IsString()
  @MaxLength(500)
  @IsUrl({ protocols: ['https'], require_protocol: true })
  websiteUrl?: string | null;

  /**
   * Whether the brand is active. Defaults to true.
   */
  @ApiPropertyOptional({ description: 'Whether the brand is active.', default: true })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}