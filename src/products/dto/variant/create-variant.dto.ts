import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsBoolean,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
  Max,
  MaxLength,
  Min,
} from 'class-validator';

import { SKU_REGEX } from '../../constants/product.constants';
import { IsMoney } from '../../../common/decorators/is-money.decorator';
import {
  ToUpperCase,
  Trim,
} from '../../../common/transforms/string.transforms';

/**
 * Defines the data required to create a product variant
 * (a purchasable color + size combination).
 *
 * ProductVariantService validates that the color and the size belong to
 * the product, that both are active, and that sizeId is present if and only
 * if the product has a size type.
 */
export class CreateVariantDto {
  /**
   * Color of the variant. It must be linked to the product.
   */
  @ApiProperty({
    description: 'Color UUID. It must already be linked to the product.',
    format: 'uuid',
  })
  @IsUUID()
  colorId: string;

  /**
   * Size of the variant. Omit or send null for products without sizes.
   */
  @ApiPropertyOptional({
    description:
      'Size UUID. Required when the product has a size type; omit for products without sizes.',
    format: 'uuid',
    nullable: true,
  })
  @IsOptional()
  @IsUUID()
  sizeId?: string | null;

  /**
   * Globally unique SKU. Normalized to uppercase.
   */
  @ApiProperty({
    description: 'Globally unique SKU (uppercase letters, digits, _ and -).',
    example: 'HD-BLK-M',
    maxLength: 100,
  })
  @Trim()
  @ToUpperCase()
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  @Matches(SKU_REGEX, {
    message:
      'sku must contain uppercase letters, digits, underscores and hyphens only.',
  })
  sku: string;

  /**
   * Optional variant price in USD. Null or omitted means the product price.
   */
  @ApiPropertyOptional({
    description:
      'Variant price in USD as a decimal string. Omit or send null to use the product price.',
    example: '55.00',
    nullable: true,
  })
  @IsOptional()
  @IsMoney()
  price?: string | null;

  /**
   * Initial stock quantity. Defaults to 0.
   */
  @ApiPropertyOptional({
    description: 'Initial stock quantity.',
    default: 0,
    minimum: 0,
    maximum: 1000000,
  })
  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(1000000)
  stockQuantity?: number;

  /**
   * Whether the variant can be sold. Defaults to true.
   */
  @ApiPropertyOptional({
    description: 'Whether the variant can be sold.',
    default: true,
  })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}