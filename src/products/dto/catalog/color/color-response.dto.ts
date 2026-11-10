import { ApiProperty } from '@nestjs/swagger';

/**
 * Color data returned by the admin API.
 */
export class ColorResponseDto {
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

  /**
   * Whether the color is active.
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