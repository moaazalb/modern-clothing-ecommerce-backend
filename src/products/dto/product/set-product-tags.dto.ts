import { ApiProperty } from '@nestjs/swagger';
import { ArrayMaxSize, ArrayUnique, IsArray, IsUUID } from 'class-validator';

/**
 * Replaces the whole set of tags of a product.
 *
 * Send an empty array to remove all tags. ProductService rejects inactive
 * or unknown tags.
 */
export class SetProductTagsDto {
  /**
   * Complete list of tag identifiers the product should have.
   */
  @ApiProperty({
    description: 'Complete list of tag UUIDs. An empty array removes all tags.',
    type: [String],
    format: 'uuid',
    maxItems: 50,
  })
  @IsArray()
  @ArrayMaxSize(50)
  @ArrayUnique()
  @IsUUID('all', { each: true })
  tagIds: string[];
}