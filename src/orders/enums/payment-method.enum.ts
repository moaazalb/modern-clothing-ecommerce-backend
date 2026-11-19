/**
 * How the customer pays for an order.
 *
 * Mirrors the shared PostgreSQL enum type "payment_method".
 *
 * COD: cash on delivery.
 * ONLINE: paid through a payment gateway (see the Payments module).
 */
export enum PaymentMethod {
  COD = 'COD',
  ONLINE = 'ONLINE',
}