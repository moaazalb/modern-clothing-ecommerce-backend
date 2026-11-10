import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

/**
 * Category data returned by the admin API.
 */
export class CategoryResponseDto {
  /**
   * Unique category identifier.
   */
  @ApiProperty({ format: 'uuid' })
  id: string;

  /**
   * Display name.
   */
  @ApiProperty({ example: 'T-Shirts' })
  name: string;

  /**
   * Unique URL slug.
   */
  @ApiProperty({ example: 't-shirts' })
  slug: string;

  /**
   * Optional description.
   */
  @ApiPropertyOptional({ type: String, nullable: true })
  description: string | null;

  /**
   * Parent category identifier. NULL for root categories.
   */
  @ApiPropertyOptional({ type: String, format: 'uuid', nullable: true })
  parentId: string | null;

  /**
   * Whether the category is active.
   */
  @ApiProperty({ example: true })
  isActive: boolean;

  /**
   * Ordering among siblings.
   */
  @ApiProperty({ example: 0 })
  sortOrder: number;

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