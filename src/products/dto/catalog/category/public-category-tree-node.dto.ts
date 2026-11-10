import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

/**
 * A node of the public category tree.
 *
 * Only categories that are effectively active are included
 * (the category and all of its ancestors are active).
 */
export class PublicCategoryTreeNodeDto {
  /**
   * Unique category identifier.
   */
  @ApiProperty({ format: 'uuid' })
  id: string;

  /**
   * Display name.
   */
  @ApiProperty({ example: 'Clothing' })
  name: string;

  /**
   * Unique URL slug.
   */
  @ApiProperty({ example: 'clothing' })
  slug: string;

  /**
   * Optional description.
   */
  @ApiPropertyOptional({ type: String, nullable: true })
  description: string | null;

  /**
   * Direct child categories, ordered by sortOrder.
   */
  @ApiProperty({ type: () => [PublicCategoryTreeNodeDto] })
  children: PublicCategoryTreeNodeDto[];
}