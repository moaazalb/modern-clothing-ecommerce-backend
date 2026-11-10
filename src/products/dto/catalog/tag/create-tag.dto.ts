import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsBoolean,
  IsNotEmpty,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
} from 'class-validator';

import { SLUG_REGEX } from '../../../constants/product.constants';
import {
  ToLowerCase,
  Trim,
} from '../../../../common/transforms/string.transforms';

/**
 * Defines the data required to create a tag.
 */
export class CreateTagDto {
  /**
   * Tag name. Unique ignoring letter case.
   */
  @ApiProperty({
    description: 'Tag name (unique, case-insensitive).',
    example: 'New Arrival',
    maxLength: 50,
  })
  @Trim()
  @IsString()
  @IsNotEmpty()
  @MaxLength(50)
  name: string;

  /**
   * Optional URL slug. When omitted, the service generates it from the name.
   */
  @ApiPropertyOptional({
    description:
      'URL slug (lowercase letters, digits, hyphens). Generated from the name when omitted.',
    example: 'new-arrival',
    maxLength: 70,
  })
  @IsOptional()
  @Trim()
  @ToLowerCase()
  @IsString()
  @MaxLength(70)
  @Matches(SLUG_REGEX, {
    message:
      'slug must contain lowercase letters, digits and single hyphens only.',
  })
  slug?: string;

  /**
   * Whether the tag is active. Defaults to true.
   */
  @ApiPropertyOptional({ description: 'Whether the tag is active.', default: true })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}