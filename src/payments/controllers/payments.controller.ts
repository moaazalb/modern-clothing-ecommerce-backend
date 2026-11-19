import {
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Post,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBadGatewayResponse,
  ApiBearerAuth,
  ApiConflictResponse,
  ApiCreatedResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
  ApiUnauthorizedResponse,
  ApiUnprocessableEntityResponse,
} from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';

import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { CurrentUserId } from '../../cart/decorators/current-user-id.decorator';
import { PaymentResponseDto } from '../dto/payment-response.dto';
import { PaymentsService } from '../services/payments.service';

/**
 * Online payment endpoints for the authenticated customer.
 *
 * Every route works only on the orders of the user in the access token.
 */
@ApiTags('Payments')
@ApiBearerAuth('access-token')
@ApiUnauthorizedResponse({ description: 'Missing or invalid access token.' })
@UseGuards(JwtAuthGuard)
@Controller('orders/:orderId/payment')
export class PaymentsController {
  /**
   * Injects the payments service.
   *
   * @param paymentsService Payment business logic.
   */
  constructor(private readonly paymentsService: PaymentsService) {}

  /**
   * Opens (or resumes) the checkout session of an online order.
   *
   * @param userId Authenticated user id.
   * @param orderId Order UUID.
   * @returns The payment attempt with the address where the customer pays.
   */
  @Post()
  @Throttle({ default: { limit: 10, ttl: 60000 } })
  @ApiOperation({
    summary: 'Start paying an online order',
    description:
      'Returns the checkoutUrl to send the customer to. Repeating the call while an attempt is pending returns the same attempt.',
  })
  @ApiCreatedResponse({ type: PaymentResponseDto })
  @ApiNotFoundResponse({
    description: 'The order does not exist or belongs to another user.',
  })
  @ApiUnprocessableEntityResponse({
    description: 'NOT_ONLINE_ORDER: the order is paid on delivery.',
  })
  @ApiConflictResponse({
    description:
      'ORDER_NOT_PAYABLE (not pending or already paid) or PAYMENT_WINDOW_EXPIRED.',
  })
  @ApiBadGatewayResponse({
    description: 'PAYMENT_PROVIDER_UNAVAILABLE: try again.',
  })
  create(
    @CurrentUserId() userId: string,
    @Param('orderId', ParseUUIDPipe) orderId: string,
  ): Promise<PaymentResponseDto> {
    return this.paymentsService.createPayment(userId, orderId);
  }

  /**
   * Returns the latest payment attempt of an order.
   *
   * @param userId Authenticated user id.
   * @param orderId Order UUID.
   * @returns The latest attempt.
   */
  @Get()
  @ApiOperation({
    summary: 'Get the payment status of my order',
    description:
      'Use it when the customer comes back from the payment page. The checkoutUrl is shown only while the attempt is PENDING.',
  })
  @ApiOkResponse({ type: PaymentResponseDto })
  @ApiNotFoundResponse({
    description:
      'The order does not exist, belongs to another user, or has no payment attempt (PAYMENT_NOT_FOUND).',
  })
  findOne(
    @CurrentUserId() userId: string,
    @Param('orderId', ParseUUIDPipe) orderId: string,
  ): Promise<PaymentResponseDto> {
    return this.paymentsService.getPayment(userId, orderId);
  }
}