import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

/**
 * Variant data returned by the admin API.
 */
export class VariantResponseDto {
  /**
   * Unique variant identifier.
   */
  @ApiProperty({ format: 'uuid' })
  id: string;

  /**
   * Identifier of the product.
   */
  @ApiProperty({ format: 'uuid' })
  productId: string;

  /**
   * Identifier of the color.
   */
  @ApiProperty({ format: 'uuid' })
  colorId: string;

  /**
   * Identifier of the size. NULL for products without sizes.
   */
  @ApiPropertyOptional({ type: String, format: 'uuid', nullable: true })
  sizeId: string | null;

  /**
   * Globally unique SKU.
   */
  @ApiProperty({ example: 'HD-BLK-M' })
  sku: string;

  /**
   * Variant price override in USD. NULL means the product price is used.
   */
  @ApiPropertyOptional({ type: String, example: '55.00', nullable: true })
  price: string | null;

  /**
   * Price actually charged: the variant price when set, otherwise the
   * product price.
   */
  @ApiProperty({ example: '55.00' })
  effectivePrice: string;

  /**
   * Units in stock.
   */
  @ApiProperty({ example: 10 })
  stockQuantity: number;

  /**
   * Whether the variant can be sold.
   */
  @ApiProperty({ example: true })
  isActive: boolean;

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
}