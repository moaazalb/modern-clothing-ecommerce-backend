import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

/**
 * Brand data returned by the public storefront API.
 */
export class PublicBrandDto {
  /**
   * Unique brand identifier.
   */
  @ApiProperty({ format: 'uuid' })
  id: string;

  /**
   * Brand name.
   */
  @ApiProperty({ example: 'Nike' })
  name: string;

  /**
   * Unique URL slug.
   */
  @ApiProperty({ example: 'nike' })
  slug: string;

  /**
   * Optional logo URL.
   */
  @ApiPropertyOptional({ type: String, nullable: true })
  logoUrl: string | null;
}