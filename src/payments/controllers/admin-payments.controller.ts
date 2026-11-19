import {
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
  ApiBadGatewayResponse,
  ApiBadRequestResponse,
  ApiConflictResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';

import { AdminOnly } from '../../auth/decorators/admin-only.decorator';
import { ApiPaginatedResponse } from '../../common/decorators/api-paginated-response.decorator';
import { PaginatedResponseDto } from '../../common/dto/paginated-response.dto';
import { AdminPaymentListQueryDto } from '../dto/admin-payment-list-query.dto';
import {
  AdminPaymentDetailDto,
  AdminPaymentSummaryDto,
} from '../dto/payment-response.dto';
import { AdminPaymentsService } from '../services/admin-payments.service';

/**
 * Admin endpoints to follow payments and retry refunds.
 */
@ApiTags('Admin / Payments')
@AdminOnly()
@Controller('admin/payments')
export class AdminPaymentsController {
  /**
   * Injects the admin payments service.
   *
   * @param adminPaymentsService Admin payment operations.
   */
  constructor(private readonly adminPaymentsService: AdminPaymentsService) {}

  /**
   * Lists payment attempts.
   *
   * @param query Filters and pagination.
   * @returns A page of payments, newest first.
   */
  @Get()
  @ApiOperation({
    summary: 'List payment attempts (paginated)',
    description:
      'Filter refundNeeded=true to see the money that still has to be returned.',
  })
  @ApiPaginatedResponse(AdminPaymentSummaryDto)
  findAll(
    @Query() query: AdminPaymentListQueryDto,
  ): Promise<PaginatedResponseDto<AdminPaymentSummaryDto>> {
    return this.adminPaymentsService.list(query);
  }

  /**
   * Retrieves a payment attempt with its webhook events.
   *
   * @param id Payment UUID.
   * @returns The admin detail.
   */
  @Get(':id')
  @ApiOperation({ summary: 'Get a payment attempt with its events' })
  @ApiOkResponse({ type: AdminPaymentDetailDto })
  @ApiBadRequestResponse({ description: 'Invalid UUID format.' })
  @ApiNotFoundResponse({ description: 'The payment does not exist.' })
  findOne(@Param('id', ParseUUIDPipe) id: string): Promise<AdminPaymentDetailDto> {
    return this.adminPaymentsService.findOne(id);
  }

  /**
   * Retries the refund of a payment now.
   *
   * @param id Payment UUID.
   * @returns The payment after the attempt.
   */
  @Post(':id/refund')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Retry the refund of a payment now',
    description:
      'Works only when the money must be returned (a cancelled paid order, a late payment, or a duplicate payment). The refund job also does it automatically every 5 minutes.',
  })
  @ApiOkResponse({ type: AdminPaymentDetailDto })
  @ApiNotFoundResponse({ description: 'The payment does not exist.' })
  @ApiConflictResponse({ description: 'REFUND_NOT_NEEDED.' })
  @ApiBadGatewayResponse({
    description: 'REFUND_FAILED: the provider refused or is unreachable.',
  })
  refund(@Param('id', ParseUUIDPipe) id: string): Promise<AdminPaymentDetailDto> {
    return this.adminPaymentsService.refund(id);
  }
}