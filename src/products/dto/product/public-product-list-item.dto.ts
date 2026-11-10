import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

import { PublicBrandDto } from '../catalog/brand/public-brand.dto';
import { PublicColorDto } from '../catalog/color/public-color.dto';
import { PublicImageDto } from '../image/public-image.dto';
import { ProductGender } from '../../enums/product.enum';

/**
 * Product card data returned by the public listing.
 *
 * status, deletedAt, isActive flags and exact stock are never exposed.
 */
export class PublicProductListItemDto {
  /**
   * Unique product identifier.
   */
  @ApiProperty({ format: 'uuid' })
  id: string;

  /**
   * Product name.
   */
  @ApiProperty({ example: 'Classic Cotton Hoodie' })
  name: string;

  /**
   * URL slug used to open the product page.
   */
  @ApiProperty({ example: 'classic-cotton-hoodie' })
  slug: string;

  /**
   * Optional short description.
   */
  @ApiPropertyOptional({ type: String, nullable: true })
  shortDescription: string | null;

  /**
   * Target gender.
   */
  @ApiProperty({ enum: ProductGender, enumName: 'ProductGender' })
  gender: ProductGender;

  /**
   * Whether the product is featured.
   */
  @ApiProperty({ example: false })
  isFeatured: boolean;

  /**
   * Lowest effective price in USD among the buyable variants.
   */
  @ApiProperty({ example: '55.00' })
  minPrice: string;

  /**
   * Highest effective price in USD among the buyable variants.
   */
  @ApiProperty({ example: '60.00' })
  maxPrice: string;

  /**
   * Whether at least one buyable variant is in stock.
   */
  @ApiProperty({ example: true })
  inStock: boolean;

  /**
   * Brand of the product. NULL when the product has no brand.
   */
  @ApiPropertyOptional({ type: () => PublicBrandDto, nullable: true })
  brand: PublicBrandDto | null;

  /**
   * Main image (sortOrder 0 of the general group). NULL when none.
   */
  @ApiPropertyOptional({ type: () => PublicImageDto, nullable: true })
  mainImage: PublicImageDto | null;

  /**
   * Colors available on the product (color swatches).
   */
  @ApiProperty({ type: () => [PublicColorDto] })
  colors: PublicColorDto[];
}