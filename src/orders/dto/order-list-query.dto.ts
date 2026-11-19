import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsOptional } from 'class-validator';

import { PaginationQueryDto } from '../../common/dto/pagination-query.dto';
import { OrderStatus } from '../enums/order-status.enum';

/**
 * Query parameters of the customer's own order list.
 */
export class OrderListQueryDto extends PaginationQueryDto {
  /**
   * Status filter.
   */
  @ApiPropertyOptional({ enum: OrderStatus, enumName: 'OrderStatus' })
  @IsOptional()
  @IsEnum(OrderStatus)
  status?: OrderStatus;
}