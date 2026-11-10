import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

/**
 * Brand data returned by the admin API.
 */
export class BrandResponseDto {
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
   * Optional description.
   */
  @ApiPropertyOptional({ type: String, nullable: true })
  description: string | null;

  /**
   * Optional logo URL.
   */
  @ApiPropertyOptional({ type: String, nullable: true })
  logoUrl: string | null;

  /**
   * Optional official website URL.
   */
  @ApiPropertyOptional({ type: String, nullable: true })
  websiteUrl: string | null;

  /**
   * Whether the brand is active.
   */
  @ApiProperty({ example: true })
  isActive: boolean;

  /**
   * Creation date.
   */
  @ApiProperty({ type: String, format: 'date-time' })
  createdAt: Date;

  /**
   * Last update date.
   */
  @ApiProperty({ type: String, format: 'date-time' })
  updatedAt: Date;
}