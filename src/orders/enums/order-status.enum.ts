/**
 * Lifecycle status of an order.
 *
 * Mirrors the shared PostgreSQL enum type "order_status".
 *
 * PENDING: placed by the customer, waiting for confirmation.
 * CONFIRMED: confirmed by the store.
 * SHIPPED: handed to the delivery.
 * DELIVERED: received by the customer (final).
 * CANCELLED: cancelled before shipping (final).
 */
export enum OrderStatus {
  PENDING = 'PENDING',
  CONFIRMED = 'CONFIRMED',
  SHIPPED = 'SHIPPED',
  DELIVERED = 'DELIVERED',
  CANCELLED = 'CANCELLED',
}