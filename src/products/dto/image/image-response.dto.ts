import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

/**
 * Image data returned by the admin API.
 *
 * The storage key is never exposed; the public URL is built by the
 * storage provider.
 */
export class ImageResponseDto {
  /**
   * Unique image identifier.
   */
  @ApiProperty({ format: 'uuid' })
  id: string;

  /**
   * Identifier of the product.
   */
  @ApiProperty({ format: 'uuid' })
  productId: string;

  /**
   * Color of the image. NULL for general product images.
   */
  @ApiPropertyOptional({ type: String, format: 'uuid', nullable: true })
  colorId: string | null;

  /**
   * Public URL of the image file.
   */
  @ApiProperty({ example: 'https://cdn.example.com/products/abc/123.webp' })
  url: string;

  /**
   * Alternative text.
   */
  @ApiPropertyOptional({ type: String, nullable: true })
  altText: string | null;

  /**
   * Position inside the group. 0 is the main image.
   */
  @ApiProperty({ example: 0 })
  sortOrder: number;

  /**
   * Creation date.
   */
  @ApiProperty({ type: String, format: 'date-time' })
  createdAt: Date;
}