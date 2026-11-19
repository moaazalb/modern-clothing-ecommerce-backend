import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

import { PublicColorDto } from '../../products/dto/catalog/color/public-color.dto';
import { PublicSizeDto } from '../../products/dto/catalog/size/public-size.dto';
import { CartItemIssue } from '../enums/cart-item-issue.enum';

/**
 * A line of the cart as shown to the customer.
 */
export class CartItemDto {
  /**
   * Cart item identifier (used to update or remove the line).
   */
  @ApiProperty({ format: 'uuid' })
  id: string;

  /**
   * Variant identifier.
   */
  @ApiProperty({ format: 'uuid' })
  variantId: string;

  /**
   * Product identifier.
   */
  @ApiProperty({ format: 'uuid' })
  productId: string;

  /**
   * Product name.
   */
  @ApiProperty({ example: 'Classic Cotton Hoodie' })
  productName: string;

  /**
   * Product slug (to link to the product page).
   */
  @ApiProperty({ example: 'classic-cotton-hoodie' })
  productSlug: string;

  /**
   * Variant SKU.
   */
  @ApiProperty({ example: 'HD-BLK-M' })
  sku: string;

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
   * Thumbnail: the main image of the variant's color, or the general main image.
   */
  @ApiPropertyOptional({ type: String, nullable: true })
  imageUrl: string | null;

  /**
   * Quantity in the cart.
   */
  @ApiProperty({ example: 2 })
  quantity: number;

  /**
   * Current price of one unit in USD.
   */
  @ApiProperty({ example: '55.00' })
  unitPrice: string;

  /**
   * unitPrice multiplied by quantity, in USD.
   */
  @ApiProperty({ example: '110.00' })
  lineTotal: string;

  /**
   * Whether the line can be bought right now. Unavailable lines are not
   * counted in the subtotal.
   */
  @ApiProperty({ example: true })
  available: boolean;

  /**
   * Why the line cannot be bought. NULL when it is available.
   */
  @ApiPropertyOptional({
    enum: CartItemIssue,
    enumName: 'CartItemIssue',
    nullable: true,
  })
  issue: CartItemIssue | null;

  /**
   * Highest quantity that can be bought now (capped by the cart limit).
   * 0 when the line is unavailable or out of stock.
   */
  @ApiProperty({ example: 10 })
  maxQuantity: number;
}

/**
 * The customer's cart with its totals.
 */
export class CartResponseDto {
  /**
   * Cart lines, oldest first.
   */
  @ApiProperty({ type: () => [CartItemDto] })
  items: CartItemDto[];

  /**
   * Total number of units in the available lines.
   */
  @ApiProperty({ example: 3 })
  itemCount: number;

  /**
   * Sum of the available lines, in USD.
   */
  @ApiProperty({ example: '165.00' })
  subtotal: string;

  /**
   * Store currency.
   */
  @ApiProperty({ example: 'USD' })
  currency: string;

  /**
   * True when at least one line cannot be bought and should be reviewed.
   */
  @ApiProperty({ example: false })
  hasUnavailableItems: boolean;
}