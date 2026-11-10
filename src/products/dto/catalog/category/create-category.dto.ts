import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsBoolean,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
  Max,
  MaxLength,
  Min,
} from 'class-validator';

import { SLUG_REGEX } from '../../../constants/product.constants';
import {
  ToLowerCase,
  Trim,
} from '../../../../common/transforms/string.transforms';

/**
 * Defines the data required to create a category.
 *
 * Gender is not part of categories. Cycle prevention, maximum depth and
 * "parent must be active" are validated in CategoryService.
 */
export class CreateCategoryDto {
  /**
   * Display name of the category.
   */
  @ApiProperty({
    description: 'Display name of the category.',
    example: 'T-Shirts',
    maxLength: 100,
  })
  @Trim()
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  name: string;

  /**
   * Optional URL slug. When omitted, the service generates it from the name.
   * It is required in practice when the name has no Latin letters or digits.
   */
  @ApiPropertyOptional({
    description:
      'URL slug (lowercase letters, digits, hyphens). Generated from the name when omitted.',
    example: 't-shirts',
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
    example: 'Short and long sleeve t-shirts.',
    nullable: true,
  })
  @IsOptional()
  @Trim()
  @IsString()
  @MaxLength(2000)
  description?: string | null;

  /**
   * Identifier of the parent category. Omit or send null for a root category.
   */
  @ApiPropertyOptional({
    description: 'Parent category UUID. Send null to make it a root category.',
    format: 'uuid',
    nullable: true,
  })
  @IsOptional()
  @IsUUID()
  parentId?: string | null;

  /**
   * Whether the category is active. Defaults to true.
   */
  @ApiPropertyOptional({ description: 'Whether the category is active.', default: true })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  /**
   * Manual ordering among siblings. Defaults to 0.
   */
  @ApiPropertyOptional({
    description: 'Ordering among siblings (0 or greater).',
    default: 0,
    minimum: 0,
    maximum: 1000000,
  })
  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(1000000)
  sortOrder?: number;
}