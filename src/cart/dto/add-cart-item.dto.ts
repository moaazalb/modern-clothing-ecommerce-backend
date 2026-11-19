import { ApiProperty } from '@nestjs/swagger';
import { IsInt, IsUUID, Max, Min } from 'class-validator';

import { CART_MAX_ITEM_QUANTITY } from '../constants/cart.constants';

/**
 * Defines the data required to add a variant to the cart.
 * Adding a variant that is already in the cart increases its quantity.
 */
export class AddCartItemDto {
  /**
   * Variant to add.
   */
  @ApiProperty({ description: 'Variant UUID.', format: 'uuid' })
  @IsUUID()
  variantId: string;

  /**
   * Quantity to add.
   */
  @ApiProperty({
    description: 'Quantity to add.',
    example: 1,
    minimum: 1,
    maximum: CART_MAX_ITEM_QUANTITY,
  })
  @IsInt()
  @Min(1)
  @Max(CART_MAX_ITEM_QUANTITY)
  quantity: number;
}