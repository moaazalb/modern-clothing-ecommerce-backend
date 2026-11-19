import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
} from '@nestjs/common';
import {
  ApiBadRequestResponse,
  ApiConflictResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
  ApiUnprocessableEntityResponse,
} from '@nestjs/swagger';

import { AdminOnly } from '../../auth/decorators/admin-only.decorator';
import { CurrentUserId } from '../../cart/decorators/current-user-id.decorator';
import { ApiPaginatedResponse } from '../../common/decorators/api-paginated-response.decorator';
import { PaginatedResponseDto } from '../../common/dto/paginated-response.dto';
import { AdminOrderListQueryDto } from '../dto/admin-order-list-query.dto';
import { AdminOrderNoteDto } from '../dto/admin-order-note.dto';
import { CancelOrderDto } from '../dto/cancel-order.dto';
import {
  AdminOrderDetailDto,
  OrderSummaryDto,
} from '../dto/order-response.dto';
import { AdminOrdersService } from '../services/admin-orders.service';
import { OrderReadService } from '../services/order-read.service';

/**
 * Admin endpoints to read orders and change their status.
 */
@ApiTags('Admin / Orders')
@AdminOnly()
@Controller('admin/orders')
export class AdminOrdersController {
  /**
   * Injects the order services.
   *
   * @param adminOrdersService Status changes.
   * @param readService Order reads.
   */
  constructor(
    private readonly adminOrdersService: AdminOrdersService,
    private readonly readService: OrderReadService,
  ) {}

  /**
   * Lists orders with filters.
   *
   * @param query Filters and pagination.
   * @returns A page of orders, newest first.
   */
  @Get()
  @ApiOperation({
    summary: 'List orders (paginated)',
    description:
      'Filters: status, paymentStatus, userId, from/to (UTC days, inclusive) and q (order number, email, name or phone).',
  })
  @ApiPaginatedResponse(OrderSummaryDto)
  @ApiUnprocessableEntityResponse({ description: 'from is after to.' })
  findAll(
    @Query() query: AdminOrderListQueryDto,
  ): Promise<PaginatedResponseDto<OrderSummaryDto>> {
    return this.readService.listForAdmin(query);
  }

  /**
   * Retrieves an order with the customer and the full history.
   *
   * @param id Order UUID.
   * @returns The admin order details.
   */
  @Get(':id')
  @ApiOperation({ summary: 'Get an order with customer and full history' })
  @ApiOkResponse({ type: AdminOrderDetailDto })
  @ApiBadRequestResponse({ description: 'Invalid UUID format.' })
  @ApiNotFoundResponse({ description: 'The order does not exist.' })
  findOne(
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<AdminOrderDetailDto> {
    return this.readService.findDetailForAdmin(id);
  }

  /**
   * Confirms a PENDING order.
   *
   * @param adminId Authenticated administrator id.
   * @param id Order UUID.
   * @param dto Optional internal note.
   * @returns The updated order.
   */
  @Post(':id/confirm')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Confirm an order (PENDING to CONFIRMED)' })
  @ApiOkResponse({ type: AdminOrderDetailDto })
  @ApiNotFoundResponse({ description: 'The order does not exist.' })
  @ApiConflictResponse({ description: 'INVALID_STATUS_TRANSITION.' })
  confirm(
    @CurrentUserId() adminId: string,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: AdminOrderNoteDto,
  ): Promise<AdminOrderDetailDto> {
    return this.adminOrdersService.confirm(id, adminId, dto);
  }

  /**
   * Marks a CONFIRMED order as shipped.
   *
   * @param adminId Authenticated administrator id.
   * @param id Order UUID.
   * @param dto Optional internal note.
   * @returns The updated order.
   */
  @Post(':id/ship')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Mark an order as shipped (CONFIRMED to SHIPPED)' })
  @ApiOkResponse({ type: AdminOrderDetailDto })
  @ApiNotFoundResponse({ description: 'The order does not exist.' })
  @ApiConflictResponse({ description: 'INVALID_STATUS_TRANSITION.' })
  ship(
    @CurrentUserId() adminId: string,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: AdminOrderNoteDto,
  ): Promise<AdminOrderDetailDto> {
    return this.adminOrdersService.ship(id, adminId, dto);
  }

  /**
   * Marks a SHIPPED order as delivered and paid.
   *
   * @param adminId Authenticated administrator id.
   * @param id Order UUID.
   * @param dto Optional internal note.
   * @returns The updated order.
   */
  @Post(':id/deliver')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Mark an order as delivered (SHIPPED to DELIVERED)',
    description: 'Cash on delivery: the payment status becomes PAID.',
  })
  @ApiOkResponse({ type: AdminOrderDetailDto })
  @ApiNotFoundResponse({ description: 'The order does not exist.' })
  @ApiConflictResponse({ description: 'INVALID_STATUS_TRANSITION.' })
  deliver(
    @CurrentUserId() adminId: string,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: AdminOrderNoteDto,
  ): Promise<AdminOrderDetailDto> {
    return this.adminOrdersService.deliver(id, adminId, dto);
  }

  /**
   * Cancels a PENDING or CONFIRMED order and puts the stock back.
   *
   * @param adminId Authenticated administrator id.
   * @param id Order UUID.
   * @param dto Optional reason (shown to the customer).
   * @returns The updated order.
   */
  @Post(':id/cancel')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Cancel an order (PENDING or CONFIRMED to CANCELLED)',
    description:
      'The stock is put back once. Cancelling an already cancelled order changes nothing.',
  })
  @ApiOkResponse({ type: AdminOrderDetailDto })
  @ApiNotFoundResponse({ description: 'The order does not exist.' })
  @ApiConflictResponse({ description: 'INVALID_STATUS_TRANSITION.' })
  cancel(
    @CurrentUserId() adminId: string,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: CancelOrderDto,
  ): Promise<AdminOrderDetailDto> {
    return this.adminOrdersService.cancel(id, adminId, dto);
  }
}