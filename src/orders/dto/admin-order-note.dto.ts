import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, MaxLength } from 'class-validator';

import { EmptyStringToUndefined } from '../../common/transforms/optional.transforms';
import { Trim } from '../../common/transforms/string.transforms';

/**
 * Optional internal note attached to an admin status change.
 * It is stored in the order history and never shown to the customer.
 */
export class AdminOrderNoteDto {
  /**
   * Internal note.
   */
  @ApiPropertyOptional({ example: 'Confirmed by phone', maxLength: 300 })
  @EmptyStringToUndefined()
  @IsOptional()
  @Trim()
  @IsString()
  @MaxLength(300)
  note?: string;
}