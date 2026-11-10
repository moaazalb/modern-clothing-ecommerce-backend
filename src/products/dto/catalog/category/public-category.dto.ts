import { ApiProperty } from '@nestjs/swagger';

/**
 * Minimal category data embedded in public product responses.
 */
export class PublicCategoryDto {
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
}