import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsBoolean,
  IsEnum,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
  MaxLength,
} from 'class-validator';

import { SLUG_REGEX } from '../../constants/product.constants';
import { IsMoney } from '../../../common/decorators/is-money.decorator';
import {
  ToLowerCase,
  Trim,
} from '../../../common/transforms/string.transforms';
import { ProductGender, SizeType } from '../../enums/product.enum';

/**
 * Defines the data required to create a product.
 *
 * A new product is always created as DRAFT: status is intentionally not
 * part of this DTO (publishing goes through the dedicated publish endpoint,
 * which validates the publishing rules). Stock and prices per variant are
 * managed through the variant endpoints.
 *
 * ProductService validates that the category (and its ancestors) and the
 * brand are active, and generates the slug from the name when it is omitted.
 */
export class CreateProductDto {
  /**
   * Display name of the product.
   */
  @ApiProperty({
    description: 'Display name of the product.',
    example: 'Classic Cotton Hoodie',
    maxLength: 200,
  })
  @Trim()
  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  name: string;

  /**
   * Optional URL slug. When omitted, the service generates it from the name.
   * It is required in practice when the name has no Latin letters or digits.
   */
  @ApiPropertyOptional({
    description:
      'URL slug (lowercase letters, digits, hyphens). Generated from the name when omitted.',
    example: 'classic-cotton-hoodie',
    maxLength: 220,
  })
  @IsOptional()
  @Trim()
  @ToLowerCase()
  @IsString()
  @MaxLength(220)
  @Matches(SLUG_REGEX, {
    message:
      'slug must contain lowercase letters, digits and single hyphens only.',
  })
  slug?: string;

  /**
   * Optional full description.
   */
  @ApiPropertyOptional({
    description: 'Optional full description.',
    nullable: true,
    maxLength: 10000,
  })
  @IsOptional()
  @Trim()
  @IsString()
  @MaxLength(10000)
  description?: string | null;

  /**
   * Optional short description shown in listings.
   */
  @ApiPropertyOptional({
    description: 'Optional short description.',
    nullable: true,
    maxLength: 300,
  })
  @IsOptional()
  @Trim()
  @IsString()
  @MaxLength(300)
  shortDescription?: string | null;

  /**
   * Base price in USD as a decimal string. It must be greater than zero
   * before the product can be published.
   */
  @ApiProperty({
    description: 'Base price in USD as a decimal string.',
    example: '55.00',
  })
  @Trim()
  @IsMoney()
  price: string;

  /**
   * Category of the product. It must be effectively active.
   */
  @ApiProperty({ description: 'Category UUID.', format: 'uuid' })
  @IsUUID()
  categoryId: string;

  /**
   * Optional brand. It must be active when provided.
   */
  @ApiPropertyOptional({
    description: 'Brand UUID. Omit or send null for no brand.',
    format: 'uuid',
    nullable: true,
  })
  @IsOptional()
  @IsUUID()
  brandId?: string | null;

  /**
   * Target gender (a product attribute, not part of categories).
   */
  @ApiProperty({ enum: ProductGender, enumName: 'ProductGender' })
  @IsEnum(ProductGender)
  gender: ProductGender;

  /**
   * Sizing system. Omit or send null for products without sizes (e.g. bags).
   * It cannot be changed once sizes or variants exist.
   */
  @ApiPropertyOptional({
    enum: SizeType,
    enumName: 'SizeType',
    nullable: true,
    description:
      'Sizing system. Omit or send null for products without sizes (e.g. bags).',
  })
  @IsOptional()
  @IsEnum(SizeType)
  sizeType?: SizeType | null;

  /**
   * Whether the product is featured on the home page. Defaults to false.
   */
  @ApiPropertyOptional({
    description: 'Whether the product is featured.',
    default: false,
  })
  @IsOptional()
  @IsBoolean()
  isFeatured?: boolean;

  /**
   * Optional SEO title.
   */
  @ApiPropertyOptional({
    description: 'Optional SEO title.',
    nullable: true,
    maxLength: 70,
  })
  @IsOptional()
  @Trim()
  @IsString()
  @MaxLength(70)
  metaTitle?: string | null;

  /**
   * Optional SEO description.
   */
  @ApiPropertyOptional({
    description: 'Optional SEO description.',
    nullable: true,
    maxLength: 160,
  })
  @IsOptional()
  @Trim()
  @IsString()
  @MaxLength(160)
  metaDescription?: string | null;
}