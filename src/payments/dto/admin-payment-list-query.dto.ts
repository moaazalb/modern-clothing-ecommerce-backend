import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsBoolean, IsEnum, IsOptional, IsUUID } from 'class-validator';

import { PaginationQueryDto } from '../../common/dto/pagination-query.dto';
import { ToBooleanQuery } from '../../common/transforms/string.transforms';
import { PaymentAttemptStatus } from '../enums/payment-attempt-status.enum';

/**
 * Query parameters of the admin payment list.
 */
export class AdminPaymentListQueryDto extends PaginationQueryDto {
  /**
   * State filter.
   */
  @ApiPropertyOptional({
    enum: PaymentAttemptStatus,
    enumName: 'PaymentAttemptStatus',
  })
  @IsOptional()
  @IsEnum(PaymentAttemptStatus)
  status?: PaymentAttemptStatus;

  /**
   * Order filter.
   */
  @ApiPropertyOptional({ format: 'uuid' })
  @IsOptional()
  @IsUUID()
  orderId?: string;

  /**
   * "true": only payments whose money must be returned. "false": all the others.
   */
  @ApiPropertyOptional({ type: Boolean, description: '"true" or "false".' })
  @IsOptional()
  @ToBooleanQuery()
  @IsBoolean()
  refundNeeded?: boolean;
}