import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsBoolean, IsEnum, IsOptional } from 'class-validator';

import { ToBooleanQuery } from '../../../common/transforms/string.transforms';
import { ProductStatus } from '../../enums/product.enum';
import { ProductListQueryDto } from './product-list-query.dto';

/**
 * Query parameters of the admin product list.
 *
 * Adds the filters that must never be public (status, featured flag).
 * Soft-deleted products are listed only by the trash endpoint.
 */
export class AdminProductListQueryDto extends ProductListQueryDto {
  /**
   * Publication status filter.
   */
  @ApiPropertyOptional({ enum: ProductStatus, enumName: 'ProductStatus' })
  @IsOptional()
  @IsEnum(ProductStatus)
  status?: ProductStatus;

  /**
   * Featured flag filter.
   */
  @ApiPropertyOptional({ type: Boolean, description: '"true" or "false".' })
  @IsOptional()
  @ToBooleanQuery()
  @IsBoolean()
  isFeatured?: boolean;
}