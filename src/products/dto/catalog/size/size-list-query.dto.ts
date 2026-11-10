import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsOptional } from 'class-validator';

import { SizeType } from '../../../enums/product.enum';
import { CatalogListQueryDto } from '../catalog-list-query.dto';

/**
 * Query parameters of the admin size list.
 * Adds the sizing-system filter on top of the common catalog filters.
 */
export class SizeListQueryDto extends CatalogListQueryDto {
  /**
   * Filters by sizing system.
   */
  @ApiPropertyOptional({ enum: SizeType, enumName: 'SizeType' })
  @IsOptional()
  @IsEnum(SizeType)
  sizeType?: SizeType;
}