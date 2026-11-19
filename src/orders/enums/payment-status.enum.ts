/**
 * Payment state of an order.
 *
 * Mirrors the shared PostgreSQL enum type "payment_status".
 *
 * UNPAID: nothing was paid yet.
 * PAID: paid (cash on delivery: when delivered; online: when the gateway confirms).
 * REFUND_PENDING: a paid order was cancelled and the money must be returned.
 * REFUNDED: the money was returned.
 */
export enum PaymentStatus {
  UNPAID = 'UNPAID',
  PAID = 'PAID',
  REFUND_PENDING = 'REFUND_PENDING',
  REFUNDED = 'REFUNDED',
}