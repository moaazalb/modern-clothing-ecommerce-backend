import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { IncomingHttpHeaders } from 'node:http';
import { createHmac, timingSafeEqual } from 'node:crypto';

import {
  DEFAULT_MOCK_WEBHOOK_SECRET,
  MOCK_PROVIDER_NAME,
  WEBHOOK_TIMESTAMP_TOLERANCE_SECONDS,
} from '../constants/payment.constants';
import {
  CreateCheckoutInput,
  CreateCheckoutResult,
  InvalidWebhookError,
  ParsedPaymentEvent,
  PaymentEventType,
  PaymentProvider,
  RefundInput,
  RefundResult,
} from './payment.provider';

/**
 * Event names the mock provider sends.
 */
const MOCK_EVENT_TYPES: Readonly<Record<string, PaymentEventType>> = {
  'payment.succeeded': 'payment.succeeded',
  'payment.failed': 'payment.failed',
  'payment.expired': 'payment.expired',
  'refund.succeeded': 'refund.succeeded',
};

/**
 * Returns the first value of a header.
 *
 * @param value Header value (a header can be repeated).
 * @returns The first value, or undefined.
 */
function firstHeader(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

/**
 * Returns a value only when it is a string.
 *
 * @param value Any value.
 * @returns The string, or null.
 */
function asStringOrNull(value: unknown): string | null {
  return typeof value === 'string' ? value : null;
}

/**
 * Development payment provider. It behaves like a real gateway: webhooks
 * are signed with HMAC-SHA256 and checked with a timing-safe comparison
 * and a timestamp window, but no money moves.
 *
 * The signature covers "<timestamp>.<raw body>" and travels in the headers
 * x-mock-timestamp and x-mock-signature. The /dev/mock-payments endpoints
 * play the role of the customer paying on the gateway page.
 *
 * It is refused in production (see payment-provider.factory.ts).
 */
@Injectable()
export class MockPaymentProvider extends PaymentProvider {
  readonly name = MOCK_PROVIDER_NAME;

  private readonly secret: string;
  private readonly baseUrl: string;

  /**
   * Reads the mock settings.
   *
   * @param configService Provides environment configuration.
   */
  constructor(configService: ConfigService) {
    super();

    this.secret =
      configService.get<string>('MOCK_PAYMENT_WEBHOOK_SECRET') ??
      DEFAULT_MOCK_WEBHOOK_SECRET;

    const port = configService.get<string>('PORT') ?? '4000';

    this.baseUrl = (
      configService.get<string>('PUBLIC_BASE_URL') ?? `http://localhost:${port}`
    ).replace(/\/+$/, '');
  }

  /**
   * Signs a webhook body.
   *
   * @param rawBody The body as text.
   * @param timestamp Unix time in seconds.
   * @returns The hexadecimal signature.
   */
  sign(rawBody: string, timestamp: number): string {
    return createHmac('sha256', this.secret)
      .update(`${timestamp}.${rawBody}`)
      .digest('hex');
  }

  /**
   * Opens a fake checkout session. The id is derived from our payment id,
   * so repeating the call returns the same session.
   *
   * @param input Payment details.
   * @returns The provider payment id and a fake checkout address.
   */
  createCheckout(input: CreateCheckoutInput): Promise<CreateCheckoutResult> {
    const providerPaymentId = `mock_${input.paymentId}`;

    return Promise.resolve({
      providerPaymentId,
      checkoutUrl: `${this.baseUrl}/dev/mock-payments/${providerPaymentId}`,
    });
  }

  /**
   * Verifies the signature and the age of a webhook, then parses it.
   *
   * @param rawBody The exact bytes received.
   * @param headers The request headers.
   * @returns The parsed event.
   * @throws InvalidWebhookError If the webhook cannot be trusted.
   */
  parseWebhook(
    rawBody: Buffer,
    headers: IncomingHttpHeaders,
  ): ParsedPaymentEvent {
    const timestamp = firstHeader(headers['x-mock-timestamp']);
    const signature = firstHeader(headers['x-mock-signature']);

    if (!timestamp || !signature || !/^\d{10}$/.test(timestamp)) {
      throw new InvalidWebhookError('Missing or malformed signature headers.');
    }

    const ageSeconds = Math.abs(Date.now() / 1000 - Number(timestamp));

    if (ageSeconds > WEBHOOK_TIMESTAMP_TOLERANCE_SECONDS) {
      throw new InvalidWebhookError('The webhook timestamp is too old.');
    }

    const body = rawBody.toString('utf8');
    const provided = Buffer.from(signature, 'hex');
    const expected = Buffer.from(this.sign(body, Number(timestamp)), 'hex');

    if (provided.length !== expected.length || !timingSafeEqual(provided, expected)) {
      throw new InvalidWebhookError('The webhook signature is invalid.');
    }

    let parsed: unknown;

    try {
      parsed = JSON.parse(body);
    } catch {
      throw new InvalidWebhookError('The webhook body is not valid JSON.');
    }

    if (typeof parsed !== 'object' || parsed === null) {
      throw new InvalidWebhookError('The webhook body must be an object.');
    }

    const content = parsed as Record<string, unknown>;
    const eventId = content.id;

    if (typeof eventId !== 'string' || eventId.length === 0 || eventId.length > 100) {
      throw new InvalidWebhookError('The webhook has no valid event id.');
    }

    const type =
      typeof content.type === 'string'
        ? (MOCK_EVENT_TYPES[content.type] ?? 'ignored')
        : 'ignored';

    return {
      eventId,
      type,
      providerPaymentId: asStringOrNull(content.paymentId),
      reference: asStringOrNull(content.reference),
      amount: asStringOrNull(content.amount),
      currency: asStringOrNull(content.currency),
      failureReason: asStringOrNull(content.reason),
      raw: content,
    };
  }

  /**
   * Pretends to refund. The result is always immediate success, and the
   * refund id is derived from the idempotency key, so repeating is safe.
   *
   * @param input Refund details.
   * @returns A successful refund.
   */
  refund(input: RefundInput): Promise<RefundResult> {
    return Promise.resolve({
      providerRefundId: `mock_refund_${input.idempotencyKey}`,
      status: 'SUCCEEDED',
    });
  }
}