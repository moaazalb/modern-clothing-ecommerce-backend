import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, IsUUID, MaxLength } from 'class-validator';

import { EmptyStringToUndefined } from '../../../common/transforms/optional.transforms';
import { Trim } from '../../../common/transforms/string.transforms';

/**
 * Defines the text fields sent with an image upload (multipart/form-data).
 *
 * The file itself is handled by the upload interceptor, not by this DTO.
 * Empty strings are treated as "not provided", because forms send them for
 * omitted fields.
 */
export class UploadImageDto {
  /**
   * Color of the image. Omit for a general product image.
   */
  @ApiPropertyOptional({
    description:
      'Color UUID for a color-specific image. Omit for a general image. The color must be linked to the product.',
    format: 'uuid',
  })
  @EmptyStringToUndefined()
  @IsOptional()
  @IsUUID()
  colorId?: string;

  /**
   * Optional alternative text for accessibility.
   */
  @ApiPropertyOptional({
    description: 'Alternative text for accessibility.',
    example: 'Black classic hoodie, front view',
    maxLength: 255,
  })
  @EmptyStringToUndefined()
  @IsOptional()
  @Trim()
  @IsString()
  @MaxLength(255)
  altText?: string;
}