import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

import { OrderStatus } from '../../orders/enums/order-status.enum';
import { PaymentStatus } from '../../orders/enums/payment-status.enum';
import { PaymentAttemptStatus } from '../enums/payment-attempt-status.enum';

/**
 * A payment attempt as shown to the customer.
 */
export class PaymentResponseDto {
  /**
   * Payment attempt identifier.
   */
  @ApiProperty({ format: 'uuid' })
  id: string;

  /**
   * Order being paid.
   */
  @ApiProperty({ format: 'uuid' })
  orderId: string;

  /**
   * State of the attempt.
   */
  @ApiProperty({
    enum: PaymentAttemptStatus,
    enumName: 'PaymentAttemptStatus',
  })
  status: PaymentAttemptStatus;

  /**
   * Amount to pay.
   */
  @ApiProperty({ example: '115.00' })
  amount: string;

  /**
   * Currency of the amount.
   */
  @ApiProperty({ example: 'USD' })
  currency: string;

  /**
   * Where to send the customer to pay. Only present while the attempt is PENDING.
   */
  @ApiPropertyOptional({ type: String, nullable: true })
  checkoutUrl: string | null;

  /**
   * Last moment the customer can pay.
   */
  @ApiProperty({ type: String, format: 'date-time' })
  expiresAt: Date;

  /**
   * When the money was received.
   */
  @ApiPropertyOptional({ type: String, format: 'date-time', nullable: true })
  paidAt: Date | null;

  /**
   * Why the attempt failed.
   */
  @ApiPropertyOptional({ type: String, nullable: true })
  failureReason: string | null;

  /**
   * When the attempt was created.
   */
  @ApiProperty({ type: String, format: 'date-time' })
  createdAt: Date;
}

/**
 * A payment attempt in the admin list.
 */
export class AdminPaymentSummaryDto {
  /**
   * Payment attempt identifier.
   */
  @ApiProperty({ format: 'uuid' })
  id: string;

  /**
   * Order being paid.
   */
  @ApiProperty({ format: 'uuid' })
  orderId: string;

  /**
   * Human-readable order number.
   */
  @ApiProperty({ example: 'MC-7K3F9Q2X' })
  orderNumber: string;

  /**
   * Payment provider.
   */
  @ApiProperty({ example: 'mock' })
  provider: string;

  /**
   * State of the attempt.
   */
  @ApiProperty({
    enum: PaymentAttemptStatus,
    enumName: 'PaymentAttemptStatus',
  })
  status: PaymentAttemptStatus;

  /**
   * Amount of the attempt.
   */
  @ApiProperty({ example: '115.00' })
  amount: string;

  /**
   * Currency of the amount.
   */
  @ApiProperty({ example: 'USD' })
  currency: string;

  /**
   * Payment state of the order itself.
   */
  @ApiProperty({ enum: PaymentStatus, enumName: 'PaymentStatus' })
  orderPaymentStatus: PaymentStatus;

  /**
   * True when the money must be returned and has not been returned yet.
   */
  @ApiProperty({ example: false })
  refundNeeded: boolean;

  /**
   * When the money was received.
   */
  @ApiPropertyOptional({ type: String, format: 'date-time', nullable: true })
  paidAt: Date | null;

  /**
   * When the attempt was created.
   */
  @ApiProperty({ type: String, format: 'date-time' })
  createdAt: Date;
}

/**
 * A webhook event as shown to admins.
 */
export class AdminPaymentEventDto {
  /**
   * Stored event identifier.
   */
  @ApiProperty({ format: 'uuid' })
  id: string;

  /**
   * Event identifier given by the provider.
   */
  @ApiProperty({ example: 'evt_123' })
  eventId: string;

  /**
   * Event type.
   */
  @ApiProperty({ example: 'payment.succeeded' })
  type: string;

  /**
   * What the system did with the event.
   */
  @ApiProperty({ example: 'APPLIED' })
  outcome: string;

  /**
   * When the event was received.
   */
  @ApiProperty({ type: String, format: 'date-time' })
  createdAt: Date;
}

/**
 * A payment attempt with its events, as shown to admins.
 */
export class AdminPaymentDetailDto extends AdminPaymentSummaryDto {
  /**
   * Payment identifier at the provider.
   */
  @ApiPropertyOptional({ type: String, nullable: true })
  providerPaymentId: string | null;

  /**
   * Status of the order.
   */
  @ApiProperty({ enum: OrderStatus, enumName: 'OrderStatus' })
  orderStatus: OrderStatus;

  /**
   * Last moment the customer could pay.
   */
  @ApiProperty({ type: String, format: 'date-time' })
  expiresAt: Date;

  /**
   * Why the attempt failed.
   */
  @ApiPropertyOptional({ type: String, nullable: true })
  failureReason: string | null;

  /**
   * When the money was returned.
   */
  @ApiPropertyOptional({ type: String, format: 'date-time', nullable: true })
  refundedAt: Date | null;

  /**
   * Last error returned by the provider when refunding.
   */
  @ApiPropertyOptional({ type: String, nullable: true })
  refundError: string | null;

  /**
   * Webhook events of this attempt, newest first.
   */
  @ApiProperty({ type: () => [AdminPaymentEventDto] })
  events: AdminPaymentEventDto[];
}