import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

import { ProductGender, ProductStatus, SizeType } from '../../enums/product.enum';

/**
 * Product data returned by the admin API (all fields).
 */
export class ProductResponseDto {
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
   * Unique URL slug (stays reserved for soft-deleted products).
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
   * Base price in USD as a decimal string.
   */
  @ApiProperty({ example: '55.00' })
  price: string;

  /**
   * Category identifier.
   */
  @ApiProperty({ format: 'uuid' })
  categoryId: string;

  /**
   * Brand identifier. NULL when the product has no brand.
   */
  @ApiPropertyOptional({ type: String, format: 'uuid', nullable: true })
  brandId: string | null;

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
   * Publication status.
   */
  @ApiProperty({ enum: ProductStatus, enumName: 'ProductStatus' })
  status: ProductStatus;

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
   * Creation date.
   */
  @ApiProperty({ type: String, format: 'date-time' })
  createdAt: Date;

  /**
   * Last update date.
   */
  @ApiProperty({ type: String, format: 'date-time' })
  updatedAt: Date;

  /**
   * Soft delete date. NULL when the product is not deleted.
   */
  @ApiPropertyOptional({ type: String, format: 'date-time', nullable: true })
  deletedAt: Date | null;
}