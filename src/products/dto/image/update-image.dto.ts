import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, MaxLength } from 'class-validator';

import { Trim } from '../../../common/transforms/string.transforms';

/**
 * Defines the fields that can be updated on an image.
 *
 * Only altText can change. Moving an image to another group means
 * deleting it and uploading it again. Sending any other field is rejected
 * by the global ValidationPipe (forbidNonWhitelisted).
 */
export class UpdateImageDto {
  /**
   * Alternative text. Send null to clear it.
   */
  @ApiPropertyOptional({
    description: 'Alternative text. Send null to clear it.',
    maxLength: 255,
    nullable: true,
  })
  @IsOptional()
  @Trim()
  @IsString()
  @MaxLength(255)
  altText?: string | null;
}