import { ApiProperty } from '@nestjs/swagger';

/**
 * Color data returned by the public storefront API.
 */
export class PublicColorDto {
  /**
   * Unique color identifier.
   */
  @ApiProperty({ format: 'uuid' })
  id: string;

  /**
   * Color name.
   */
  @ApiProperty({ example: 'Navy' })
  name: string;

  /**
   * Unique URL slug.
   */
  @ApiProperty({ example: 'navy' })
  slug: string;

  /**
   * Hex color code.
   */
  @ApiProperty({ example: '#000080' })
  hexCode: string;
}