/**
 * State of one payment attempt (one row of the payments table).
 *
 * Mirrors the PostgreSQL enum type "payment_attempt_status".
 *
 * PENDING: the customer has not finished paying.
 * SUCCEEDED: the gateway confirmed the payment.
 * FAILED: the gateway reported a failure.
 * EXPIRED: the time to pay ran out.
 * REFUND_PENDING: the money was received but must be returned (late or duplicate payment).
 * REFUNDED: the money was returned.
 */
export enum PaymentAttemptStatus {
  PENDING = 'PENDING',
  SUCCEEDED = 'SUCCEEDED',
  FAILED = 'FAILED',
  EXPIRED = 'EXPIRED',
  REFUND_PENDING = 'REFUND_PENDING',
  REFUNDED = 'REFUNDED',
}