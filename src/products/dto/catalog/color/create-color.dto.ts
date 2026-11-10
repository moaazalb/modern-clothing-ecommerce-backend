import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsBoolean,
  IsNotEmpty,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
} from 'class-validator';

import {
  HEX_COLOR_REGEX,
  SLUG_REGEX,
} from '../../../constants/product.constants';
import {
  ToLowerCase,
  ToUpperCase,
  Trim,
} from '../../../../common/transforms/string.transforms';

/**
 * Defines the data required to create a color.
 */
export class CreateColorDto {
  /**
   * Color name. Unique ignoring letter case.
   */
  @ApiProperty({
    description: 'Color name (unique, case-insensitive).',
    example: 'Navy',
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
    example: 'navy',
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
   * Hex color code (#RRGGBB). Normalized to uppercase.
   */
  @ApiProperty({
    description: 'Hex color code in the format #RRGGBB (stored uppercase).',
    example: '#000080',
  })
  @Trim()
  @ToUpperCase()
  @IsString()
  @Matches(HEX_COLOR_REGEX, {
    message: 'hexCode must be in the format #RRGGBB.',
  })
  hexCode: string;

  /**
   * Whether the color is active. Defaults to true.
   */
  @ApiPropertyOptional({ description: 'Whether the color is active.', default: true })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}