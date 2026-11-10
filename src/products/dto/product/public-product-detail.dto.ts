import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

import { PublicBrandDto } from '../catalog/brand/public-brand.dto';
import { PublicCategoryDto } from '../catalog/category/public-category.dto';
import { PublicColorDto } from '../catalog/color/public-color.dto';
import { PublicSizeDto } from '../catalog/size/public-size.dto';
import { PublicTagDto } from '../catalog/tag/public-tag.dto';
import { PublicImageDto } from '../image/public-image.dto';
import { PublicVariantDto } from '../variant/public-variant.dto';
import { ProductGender, SizeType } from '../../enums/product.enum';

/**
 * Full product data returned by the public product page.
 *
 * status, deletedAt, isActive flags and exact stock are never exposed.
 * Colors, sizes, tags and variants contain only enabled records.
 */
export class PublicProductDetailDto {
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
   * URL slug.
   */
  @ApiProperty({ example: 'classic-cotton-hoodie' })
  slug: string;

  /**
   * Optional full description.
   */
  @ApiPropertyOptional({ type: String, nullable: true })
  description: string | null;

  /**
   * Optional short description.
   */
  @ApiPropertyOptional({ type: String, nullable: true })
  shortDescription: string | null;

  /**
   * Base price in USD. A variant may charge a different price.
   */
  @ApiProperty({ example: '55.00' })
  price: string;

  /**
   * Target gender.
   */
  @ApiProperty({ enum: ProductGender, enumName: 'ProductGender' })
  gender: ProductGender;

  /**
   * Sizing system. NULL for products without sizes.
   */
  @ApiPropertyOptional({
    enum: SizeType,
    enumName: 'SizeType',
    nullable: true,
  })
  sizeType: SizeType | null;

  /**
   * Whether the product is featured.
   */
  @ApiProperty({ example: false })
  isFeatured: boolean;

  /**
   * Optional SEO title.
   */
  @ApiPropertyOptional({ type: String, nullable: true })
  metaTitle: string | null;

  /**
   * Optional SEO description.
   */
  @ApiPropertyOptional({ type: String, nullable: true })
  metaDescription: string | null;

  /**
   * Whether at least one buyable variant is in stock.
   */
  @ApiProperty({ example: true })
  inStock: boolean;

  /**
   * Category of the product.
   */
  @ApiProperty({ type: () => PublicCategoryDto })
  category: PublicCategoryDto;

  /**
   * Brand of the product. NULL when the product has no brand.
   */
  @ApiPropertyOptional({ type: () => PublicBrandDto, nullable: true })
  brand: PublicBrandDto | null;

  /**
   * Enabled colors linked to the product.
   */
  @ApiProperty({ type: () => [PublicColorDto] })
  colors: PublicColorDto[];

  /**
   * Enabled sizes linked to the product. Empty for products without sizes.
   */
  @ApiProperty({ type: () => [PublicSizeDto] })
  sizes: PublicSizeDto[];

  /**
   * Enabled tags linked to the product.
   */
  @ApiProperty({ type: () => [PublicTagDto] })
  tags: PublicTagDto[];

  /**
   * Images ordered by group and sortOrder.
   */
  @ApiProperty({ type: () => [PublicImageDto] })
  images: PublicImageDto[];

  /**
   * Variants that can be offered to customers.
   */
  @ApiProperty({ type: () => [PublicVariantDto] })
  variants: PublicVariantDto[];
}