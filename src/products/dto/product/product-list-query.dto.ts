import { ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsBoolean,
  IsEnum,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
} from 'class-validator';

import { IsMoney } from '../../../common/decorators/is-money.decorator';
import { PaginationQueryDto } from '../../../common/dto/pagination-query.dto';
import {
  ToBooleanQuery,
  Trim,
} from '../../../common/transforms/string.transforms';
import { ProductGender, ProductSort } from '../../enums/product.enum';

/**
 * Query parameters of the public product listing.
 *
 * Every filter is optional and whitelisted. The category filter includes
 * all descendant categories. Price filters apply to the effective price
 * (variant price or product price). The service ignores an empty q, and
 * rejects minPrice greater than maxPrice with 422.
 */
export class ProductListQueryDto extends PaginationQueryDto {
  /**
   * Sort order. Defaults to newest first.
   */
  @ApiPropertyOptional({
    enum: ProductSort,
    enumName: 'ProductSort',
    default: ProductSort.NEWEST,
  })
  @IsOptional()
  @IsEnum(ProductSort)
  sort?: ProductSort;

  /**
   * Category filter (includes descendant categories).
   */
  @ApiPropertyOptional({ format: 'uuid' })
  @IsOptional()
  @IsUUID()
  categoryId?: string;

  /**
   * Brand filter.
   */
  @ApiPropertyOptional({ format: 'uuid' })
  @IsOptional()
  @IsUUID()
  brandId?: string;

  /**
   * Gender filter.
   */
  @ApiPropertyOptional({ enum: ProductGender, enumName: 'ProductGender' })
  @IsOptional()
  @IsEnum(ProductGender)
  gender?: ProductGender;

  /**
   * Tag filter.
   */
  @ApiPropertyOptional({ format: 'uuid' })
  @IsOptional()
  @IsUUID()
  tagId?: string;

  /**
   * Color filter (buyable variants only).
   */
  @ApiPropertyOptional({ format: 'uuid' })
  @IsOptional()
  @IsUUID()
  colorId?: string;

  /**
   * Size filter (buyable variants only).
   */
  @ApiPropertyOptional({ format: 'uuid' })
  @IsOptional()
  @IsUUID()
  sizeId?: string;

  /**
   * Minimum effective price in USD.
   */
  @ApiPropertyOptional({ example: '10.00' })
  @IsOptional()
  @Trim()
  @IsMoney()
  minPrice?: string;

  /**
   * Maximum effective price in USD.
   */
  @ApiPropertyOptional({ example: '100.00' })
  @IsOptional()
  @Trim()
  @IsMoney()
  maxPrice?: string;

  /**
   * Only products with at least one buyable variant in stock.
   */
  @ApiPropertyOptional({ type: Boolean, description: '"true" or "false".' })
  @IsOptional()
  @ToBooleanQuery()
  @IsBoolean()
  inStock?: boolean;

  /**
   * Case-insensitive text search.
   */
  @ApiPropertyOptional({ maxLength: 100, example: 'hoodie' })
  @IsOptional()
  @Trim()
  @IsString()
  @MaxLength(100)
  q?: string;
}