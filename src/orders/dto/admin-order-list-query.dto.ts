import { ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsEnum,
  IsISO8601,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
  MaxLength,
} from 'class-validator';

import { Trim } from '../../common/transforms/string.transforms';
import { PaymentStatus } from '../enums/payment-status.enum';
import { OrderListQueryDto } from './order-list-query.dto';

/**
 * Query parameters of the admin order list.
 *
 * Dates are calendar days in UTC (YYYY-MM-DD). Both ends are inclusive.
 */
export class AdminOrderListQueryDto extends OrderListQueryDto {
  /**
   * Payment status filter.
   */
  @ApiPropertyOptional({ enum: PaymentStatus, enumName: 'PaymentStatus' })
  @IsOptional()
  @IsEnum(PaymentStatus)
  paymentStatus?: PaymentStatus;

  /**
   * Customer filter.
   */
  @ApiPropertyOptional({ format: 'uuid' })
  @IsOptional()
  @IsUUID()
  userId?: string;

  /**
   * First day (inclusive), UTC.
   */
  @ApiPropertyOptional({ example: '2026-11-01' })
  @IsOptional()
  @Matches(/^\d{4}-\d{2}-\d{2}$/, {
    message: 'from must be a date in the format YYYY-MM-DD.',
  })
  @IsISO8601({ strict: true })
  from?: string;

  /**
   * Last day (inclusive), UTC.
   */
  @ApiPropertyOptional({ example: '2026-11-30' })
  @IsOptional()
  @Matches(/^\d{4}-\d{2}-\d{2}$/, {
    message: 'to must be a date in the format YYYY-MM-DD.',
  })
  @IsISO8601({ strict: true })
  to?: string;

  /**
   * Text search in the order number, email, name and phone.
   */
  @ApiPropertyOptional({ maxLength: 100, example: 'MC-7K3F' })
  @IsOptional()
  @Trim()
  @IsString()
  @MaxLength(100)
  q?: string;
}