import type { IncomingHttpHeaders } from 'node:http';

/**
 * Data needed to open a checkout session at the provider.
 */
export interface CreateCheckoutInput {
  /** Our payment id. Use it as the idempotency key at the provider. */
  paymentId: string;
  orderId: string;
  orderNumber: string;
  /** Amount as a decimal string, in the currency below. */
  amount: string;
  currency: string;
  customerEmail: string;
  /** Where the provider sends the customer back after paying. */
  returnUrl: string;
  expiresAt: Date;
}

/**
 * Result of opening a checkout session.
 */
export interface CreateCheckoutResult {
  providerPaymentId: string;
  checkoutUrl: string;
}

/**
 * Kinds of events the system understands. Anything else is "ignored".
 */
export type PaymentEventType =
  | 'payment.succeeded'
  | 'payment.failed'
  | 'payment.expired'
  | 'refund.succeeded'
  | 'ignored';

/**
 * A webhook event after its signature was verified and its content parsed.
 */
export interface ParsedPaymentEvent {
  /** Unique event id given by the provider (used for idempotency). */
  eventId: string;
  type: PaymentEventType;
  providerPaymentId: string | null;
  /** Our payment id, when the provider echoes it back (metadata/reference). */
  reference: string | null;
  amount: string | null;
  currency: string | null;
  failureReason: string | null;
  /** The raw content, stored for audit. */
  raw: Record<string, unknown>;
}

/**
 * Data needed to refund a payment.
 */
export interface RefundInput {
  providerPaymentId: string;
  amount: string;
  currency: string;
  /** Stable per payment: repeating the call must not refund twice. */
  idempotencyKey: string;
}

/**
 * Result of a refund request.
 */
export interface RefundResult {
  providerRefundId: string;
  /** PENDING means the provider will confirm later with a refund.succeeded event. */
  status: 'SUCCEEDED' | 'PENDING';
}

/**
 * Thrown by a provider when a webhook has a bad signature, an old
 * timestamp or an unreadable body.
 */
export class InvalidWebhookError extends Error {}

/**
 * Contract of a payment gateway adapter.
 *
 * It is an abstract class so it is also the injection token: the payments
 * module depends on this contract only. To support a real gateway, write a
 * class that extends it and register it in payment-provider.factory.ts.
 */
export abstract class PaymentProvider {
  /**
   * Short unique name (also the :provider part of the webhook address).
   */
  abstract readonly name: string;

  /**
   * Opens a checkout session where the customer pays.
   *
   * @param input Payment details.
   * @returns The provider payment id and the address to send the customer to.
   */
  abstract createCheckout(
    input: CreateCheckoutInput,
  ): Promise<CreateCheckoutResult>;

  /**
   * Verifies the signature of a webhook and parses its content.
   *
   * @param rawBody The exact bytes received (the signature covers them).
   * @param headers The request headers.
   * @returns The parsed event.
   * @throws InvalidWebhookError If the webhook cannot be trusted.
   */
  abstract parseWebhook(
    rawBody: Buffer,
    headers: IncomingHttpHeaders,
  ): ParsedPaymentEvent;

  /**
   * Refunds a payment in full.
   *
   * @param input Refund details.
   * @returns The refund result.
   */
  abstract refund(input: RefundInput): Promise<RefundResult>;
}