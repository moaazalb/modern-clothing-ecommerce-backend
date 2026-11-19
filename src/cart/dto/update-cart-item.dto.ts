import { ApiProperty } from '@nestjs/swagger';
import { IsInt, Max, Min } from 'class-validator';

import { CART_MAX_ITEM_QUANTITY } from '../constants/cart.constants';

/**
 * Defines the new quantity of a cart item.
 * To remove an item, use the delete endpoint.
 */
export class UpdateCartItemDto {
  /**
   * New absolute quantity.
   */
  @ApiProperty({
    description: 'New quantity (replaces the current one).',
    example: 2,
    minimum: 1,
    maximum: CART_MAX_ITEM_QUANTITY,
  })
  @IsInt()
  @Min(1)
  @Max(CART_MAX_ITEM_QUANTITY)
  quantity: number;
}