import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, MaxLength } from 'class-validator';

import { EmptyStringToUndefined } from '../../common/transforms/optional.transforms';
import { Trim } from '../../common/transforms/string.transforms';

/**
 * Optional data when cancelling an order (by the customer or an admin).
 * The reason is shown to the customer.
 */
export class CancelOrderDto {
  /**
   * Reason of the cancellation.
   */
  @ApiPropertyOptional({ example: 'Ordered by mistake', maxLength: 300 })
  @EmptyStringToUndefined()
  @IsOptional()
  @Trim()
  @IsString()
  @MaxLength(300)
  reason?: string;
}