import {
  AdminPaymentDetailDto,
  AdminPaymentSummaryDto,
  PaymentResponseDto,
} from '../dto/payment-response.dto';
import { PaymentEvent } from '../entities/payment-event.entity';
import { Payment } from '../entities/payment.entity';
import { PaymentAttemptStatus } from '../enums/payment-attempt-status.enum';
import { Order } from '../../orders/entities/order.entity';

/**
 * A raw row of the admin payment list query.
 */
export interface AdminPaymentRow {
  id: string;
  orderId: string;
  orderNumber: string;
  provider: string;
  status: AdminPaymentSummaryDto['status'];
  amount: string;
  currency: string;
  orderPaymentStatus: AdminPaymentSummaryDto['orderPaymentStatus'];
  refundNeeded: boolean;
  paidAt: Date | null;
  createdAt: Date;
}

/**
 * Converts a payment into the customer view. The checkout address is only
 * shown while the customer can still use it.
 *
 * @param payment Payment entity.
 * @returns Customer data.
 */
export function toPaymentResponse(payment: Payment): PaymentResponseDto {
  return {
    id: payment.id,
    orderId: payment.orderId,
    status: payment.status,
    amount: payment.amount,
    currency: payment.currency,
    checkoutUrl:
      payment.status === PaymentAttemptStatus.PENDING
        ? payment.checkoutUrl
        : null,
    expiresAt: payment.expiresAt,
    paidAt: payment.paidAt,
    failureReason: payment.failureReason,
    createdAt: payment.createdAt,
  };
}

/**
 * Converts a list row into the admin summary.
 *
 * @param row Raw row of the list query.
 * @returns Admin summary data.
 */
export function toAdminSummary(row: AdminPaymentRow): AdminPaymentSummaryDto {
  return {
    id: row.id,
    orderId: row.orderId,
    orderNumber: row.orderNumber,
    provider: row.provider,
    status: row.status,
    amount: row.amount,
    currency: row.currency,
    orderPaymentStatus: row.orderPaymentStatus,
    refundNeeded: row.refundNeeded,
    paidAt: row.paidAt,
    createdAt: row.createdAt,
  };
}

/**
 * Builds the admin detail of a payment.
 *
 * @param payment Payment entity.
 * @param order The order being paid.
 * @param events Webhook events of the payment, newest first.
 * @returns Admin detail data.
 */
export function toAdminDetail(
  payment: Payment,
  order: Order,
  events: PaymentEvent[],
): AdminPaymentDetailDto {
  const refundNeeded =
    payment.status === PaymentAttemptStatus.REFUND_PENDING ||
    (payment.status === PaymentAttemptStatus.SUCCEEDED &&
      order.status === 'CANCELLED');

  return {
    id: payment.id,
    orderId: payment.orderId,
    orderNumber: order.orderNumber,
    provider: payment.provider,
    status: payment.status,
    amount: payment.amount,
    currency: payment.currency,
    orderPaymentStatus: order.paymentStatus,
    refundNeeded,
    paidAt: payment.paidAt,
    createdAt: payment.createdAt,
    providerPaymentId: payment.providerPaymentId,
    orderStatus: order.status,
    expiresAt: payment.expiresAt,
    failureReason: payment.failureReason,
    refundedAt: payment.refundedAt,
    refundError: payment.refundError,
    events: events.map((event) => ({
      id: event.id,
      eventId: event.eventId,
      type: event.type,
      outcome: event.outcome,
      createdAt: event.createdAt,
    })),
  };
}
