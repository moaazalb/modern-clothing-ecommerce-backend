import { ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsBoolean,
  IsOptional,
  IsString,
  MaxLength,
} from 'class-validator';

import { PaginationQueryDto } from '../../../common/dto/pagination-query.dto';
import {
  ToBooleanQuery,
  Trim,
} from '../../../common/transforms/string.transforms';

/**
 * Query parameters for the admin lists of reference data
 * (categories, brands, tags, colors, sizes).
 */
export class CatalogListQueryDto extends PaginationQueryDto {
  /**
   * Case-insensitive search by name.
   */
  @ApiPropertyOptional({
    description: 'Case-insensitive search by name.',
    maxLength: 100,
    example: 'shirt',
  })
  @IsOptional()
  @Trim()
  @IsString()
  @MaxLength(100)
  q?: string;

  /**
   * Filters by the active flag ("true" or "false").
   */
  @ApiPropertyOptional({
    description: 'Filter by active status ("true" or "false").',
    type: Boolean,
  })
  @IsOptional()
  @ToBooleanQuery()
  @IsBoolean()
  isActive?: boolean;
}