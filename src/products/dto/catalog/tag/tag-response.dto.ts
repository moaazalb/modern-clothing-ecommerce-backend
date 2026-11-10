import { ApiProperty } from '@nestjs/swagger';

/**
 * Tag data returned by the admin API.
 */
export class TagResponseDto {
  /**
   * Unique tag identifier.
   */
  @ApiProperty({ format: 'uuid' })
  id: string;

  /**
   * Tag name.
   */
  @ApiProperty({ example: 'New Arrival' })
  name: string;

  /**
   * Unique URL slug.
   */
  @ApiProperty({ example: 'new-arrival' })
  slug: string;

  /**
   * Whether the tag is active.
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