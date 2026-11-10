import { ApiProperty } from '@nestjs/swagger';
import { IsUUID } from 'class-validator';

/**
 * Links a color to a product.
 *
 * ProductService rejects inactive or unknown colors. Removing a color that
 * is used by a variant or an image is rejected with 409.
 */
export class AddProductColorDto {
  /**
   * Color to link to the product.
   */
  @ApiProperty({ description: 'Color UUID.', format: 'uuid' })
  @IsUUID()
  colorId: string;
}