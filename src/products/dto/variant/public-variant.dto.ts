import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

import { PublicColorDto } from '../catalog/color/public-color.dto';
import { PublicSizeDto } from '../catalog/size/public-size.dto';

/**
 * Variant data returned by the public storefront API.
 *
 * The exact stock quantity is never exposed, only whether the variant
 * can currently be bought.
 */
export class PublicVariantDto {
  /**
   * Unique variant identifier (used when adding to cart or ordering).
   */
  @ApiProperty({ format: 'uuid' })
  id: string;

  /**
   * Color of the variant.
   */
  @ApiProperty({ type: () => PublicColorDto })
  color: PublicColorDto;

  /**
   * Size of the variant. NULL for products without sizes.
   */
  @ApiPropertyOptional({ type: () => PublicSizeDto, nullable: true })
  size: PublicSizeDto | null;

  /**
   * Price charged for this variant in USD.
   */
  @ApiProperty({ example: '55.00' })
  price: string;

  /**
   * Whether the variant can currently be bought.
   */
  @ApiProperty({ example: true })
  inStock: boolean;
}