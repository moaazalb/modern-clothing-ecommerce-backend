import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

import { BrandResponseDto } from '../catalog/brand/brand-response.dto';
import { CategoryResponseDto } from '../catalog/category/category-response.dto';
import { ColorResponseDto } from '../catalog/color/color-response.dto';
import { SizeResponseDto } from '../catalog/size/size-response.dto';
import { TagResponseDto } from '../catalog/tag/tag-response.dto';
import { ImageResponseDto } from '../image/image-response.dto';
import { VariantResponseDto } from '../variant/variant-response.dto';
import { ProductResponseDto } from './product-response.dto';

/**
 * Full product data returned by the admin detail endpoint:
 * the product with its related records.
 */
export class AdminProductDetailDto extends ProductResponseDto {
  /**
   * Category of the product.
   */
  @ApiProperty({ type: () => CategoryResponseDto })
  category: CategoryResponseDto;

  /**
   * Brand of the product. NULL when the product has no brand.
   */
  @ApiPropertyOptional({ type: () => BrandResponseDto, nullable: true })
  brand: BrandResponseDto | null;

  /**
   * Colors linked to the product.
   */
  @ApiProperty({ type: () => [ColorResponseDto] })
  colors: ColorResponseDto[];

  /**
   * Sizes linked to the product. Empty for products without sizes.
   */
  @ApiProperty({ type: () => [SizeResponseDto] })
  sizes: SizeResponseDto[];

  /**
   * Tags linked to the product.
   */
  @ApiProperty({ type: () => [TagResponseDto] })
  tags: TagResponseDto[];

  /**
   * All variants, including inactive ones.
   */
  @ApiProperty({ type: () => [VariantResponseDto] })
  variants: VariantResponseDto[];

  /**
   * All images, ordered by group and sortOrder.
   */
  @ApiProperty({ type: () => [ImageResponseDto] })
  images: ImageResponseDto[];
}