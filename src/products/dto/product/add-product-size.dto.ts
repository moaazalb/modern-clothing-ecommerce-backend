import { ApiProperty } from '@nestjs/swagger';
import { IsUUID } from 'class-validator';

/**
 * Links a size to a product.
 *
 * The size must belong to the product's sizeType: the service returns a
 * clear 422 message, and the composite foreign keys enforce it in the
 * database. Removing a size that is used by a variant is rejected with 409.
 */
export class AddProductSizeDto {
  /**
   * Size to link to the product.
   */
  @ApiProperty({ description: 'Size UUID.', format: 'uuid' })
  @IsUUID()
  sizeId: string;
}