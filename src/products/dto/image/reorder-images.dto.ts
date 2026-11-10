import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  ArrayMaxSize,
  ArrayMinSize,
  ArrayUnique,
  IsArray,
  IsOptional,
  IsUUID,
} from 'class-validator';

/**
 * Defines the new order of the images of one group.
 *
 * ProductImageService validates that imageIds contains exactly the images
 * of the group (no missing and no foreign image), then assigns the
 * positions 0..n-1 in one transaction with the sort-order constraint
 * deferred.
 */
export class ReorderImagesDto {
  /**
   * Group to reorder. Null or omitted means the general product images.
   */
  @ApiPropertyOptional({
    description:
      'Color UUID of the group to reorder. Omit or send null for the general images.',
    format: 'uuid',
    nullable: true,
  })
  @IsOptional()
  @IsUUID()
  colorId?: string | null;

  /**
   * All image identifiers of the group, in the desired order.
   */
  @ApiProperty({
    description:
      'All image UUIDs of the group in the desired order (first = main image).',
    type: [String],
    format: 'uuid',
    minItems: 1,
    maxItems: 20,
  })
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(20)
  @ArrayUnique()
  @IsUUID('all', { each: true })
  imageIds: string[];
}