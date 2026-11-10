import { ApiProperty } from '@nestjs/swagger';

/**
 * Tag data returned by the public storefront API.
 */
export class PublicTagDto {
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
}