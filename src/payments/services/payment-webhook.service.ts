import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import type { IncomingHttpHeaders } from 'node:http';
import { isUUID } from 'class-validator';
import { DataSource, EntityManager, Not } from 'typeorm';

import { toCents } from '../../common/utils/money.util';
import { Order } from '../../orders/entities/order.entity';
import { OrderStatus } from '../../orders/enums/order-status.enum';
import { PaymentStatus } from '../../orders/enums/payment-status.enum';
import { OrderStateService } from '../../orders/services/order-state.service';
import { Payment } from '../entities/payment.entity';
import { PaymentAttemptStatus } from '../enums/payment-attempt-status.enum';
import {
  InvalidWebhookError,
  ParsedPaymentEvent,
  PaymentProvider,
} from '../providers/payment.provider';
import { PaymentRefundService } from './payment-refund.service';

/**
 * What the system did with an event, and whether a refund must follow.
 */
interface DispatchResult {
  outcome: string;
  refundPaymentId: string | null;
}

/**
 * Stores a webhook event once. A repeated (provider, eventId) inserts
 * nothing, which is how duplicates are recognized.
 */
const RECORD_EVENT_SQL = `
  INSERT INTO "payment_events"
    ("provider", "eventId", "type", "providerPaymentId", "paymentId", "payload", "outcome")
  VALUES ($1, $2, $3, $4, $5, $6::jsonb, 'RECEIVED')
  ON CONFLICT ("provider", "eventId") DO NOTHING
  RETURNING "id"`;

/**
 * Webhook processing.
 *
 * Security: the signature is verified on the raw body before anything is
 * read. Idempotency: the event is stored and its effects applied in ONE
 * transaction, so a failure rolls both back and the gateway's retry is
 * processed again, while a repeated event is recognized and ignored.
 *
 * Lock order is always: the order row first, then the payment row.
 */
@Injectable()
export class PaymentWebhookService {
  private readonly logger = new Logger(PaymentWebhookService.name);

  /**
   * Injects the services this class relies on.
   *
   * @param dataSource TypeORM data source used to open transactions.
   * @param provider The payment gateway adapter.
   * @param orderState Order status machine.
   * @param refundService Refund operations.
   */
  constructor(
    private readonly dataSource: DataSource,
    private readonly provider: PaymentProvider,
    private readonly orderState: OrderStateService,
    private readonly refundService: PaymentRefundService,
  ) {}

  /**
   * Handles a webhook request.
   *
   * @param providerName Provider named in the address.
   * @param rawBody The exact bytes received.
   * @param headers The request headers.
   * @throws NotFoundException If the provider is not the configured one.
   * @throws BadRequestException If the webhook cannot be trusted.
   */
  async handle(
    providerName: string,
    rawBody: Buffer,
    headers: IncomingHttpHeaders,
  ): Promise<void> {
    if (providerName !== this.provider.name) {
      throw new NotFoundException();
    }

    let event: ParsedPaymentEvent;

    try {
      event = this.provider.parseWebhook(rawBody, headers);
    } catch (error) {
      if (error instanceof InvalidWebhookError) {
        this.logger.warn(`Rejected a webhook: ${error.message}`);
        throw new BadRequestException('Invalid webhook.');
      }

      throw error;
    }

    const refundPaymentId = await this.dataSource.transaction((manager) =>
      this.apply(manager, event),
    );

    if (refundPaymentId) {
      await this.refundService.tryRefund(refundPaymentId);
    }
  }

  /**
   * Finds the payment an event is about.
   *
   * @param manager Entity manager of the running transaction.
   * @param event The parsed event.
   * @returns The payment, or null if none matches.
   */
  private async findPayment(
    manager: EntityManager,
    event: ParsedPaymentEvent,
  ): Promise<Payment | null> {
    if (event.providerPaymentId) {
      const found = await manager.findOne(Payment, {
        where: {
          provider: this.provider.name,
          providerPaymentId: event.providerPaymentId,
        },
      });

      if (found) {
        return found;
      }
    }

    if (event.reference && isUUID(event.reference)) {
      return manager.findOne(Payment, {
        where: { id: event.reference, provider: this.provider.name },
      });
    }

    return null;
  }

  /**
   * Stores the event and applies its effects, all inside one transaction.
   *
   * @param manager Entity manager of the running transaction.
   * @param event The parsed event.
   * @returns The payment that must be refunded after the commit, if any.
   */
  private async apply(
    manager: EntityManager,
    event: ParsedPaymentEvent,
  ): Promise<string | null> {
    const found = await this.findPayment(manager, event);

    let order: Order | null = null;
    let payment: Payment | null = null;

    if (found) {
      order = await this.orderState.lockOrder(manager, found.orderId);
      payment = await manager.findOne(Payment, {
        where: { id: found.id },
        lock: { mode: 'pessimistic_write' },
      });
    }

    const stored: { id: string }[] = await manager.query(RECORD_EVENT_SQL, [
      this.provider.name,
      event.eventId,
      event.type,
      event.providerPaymentId,
      payment?.id ?? null,
      JSON.stringify(event.raw),
    ]);

    const eventRowId = stored[0]?.id;

    if (!eventRowId) {
      return null;
    }

    const result = await this.dispatch(manager, event, payment, order);

    await manager.query(
      `UPDATE "payment_events" SET "outcome" = $2 WHERE "id" = $1`,
      [eventRowId, result.outcome],
    );

    return result.refundPaymentId;
  }

  /**
   * Chooses what to do with an event.
   *
   * @param manager Entity manager of the running transaction.
   * @param event The parsed event.
   * @param payment The locked payment, or null.
   * @param order The locked order, or null.
   * @returns The outcome and the payment to refund, if any.
   */
  private async dispatch(
    manager: EntityManager,
    event: ParsedPaymentEvent,
    payment: Payment | null,
    order: Order | null,
  ): Promise<DispatchResult> {
    if (event.type === 'ignored') {
      return { outcome: 'IGNORED', refundPaymentId: null };
    }

    if (!payment || !order) {
      this.logger.warn(`Event ${event.eventId} matches no payment.`);
      return { outcome: 'UNKNOWN_PAYMENT', refundPaymentId: null };
    }

    if (!payment.providerPaymentId && event.providerPaymentId) {
      await manager.update(
        Payment,
        { id: payment.id },
        { providerPaymentId: event.providerPaymentId },
      );
    }

    switch (event.type) {
      case 'payment.succeeded':
        return this.onSucceeded(manager, event, payment, order);
      case 'payment.failed':
        return this.onClosed(
          manager,
          payment,
          PaymentAttemptStatus.FAILED,
          event.failureReason,
        );
      case 'payment.expired':
        return this.onClosed(
          manager,
          payment,
          PaymentAttemptStatus.EXPIRED,
          null,
        );
      default:
        return this.onRefundSucceeded(manager, payment, order);
    }
  }

  /**
   * Handles a confirmed payment.
   *
   * - normal case: the payment succeeds, the order becomes PAID and CONFIRMED;
   * - the order was cancelled meanwhile (late payment): the money must be returned;
   * - the order is already paid by another attempt (duplicate payment): the money must be returned;
   * - the amount or the currency differs from what we asked: nothing is applied.
   *
   * @param manager Entity manager of the running transaction.
   * @param event The parsed event.
   * @param payment The locked payment.
   * @param order The locked order.
   * @returns The outcome and the payment to refund, if any.
   */
  private async onSucceeded(
    manager: EntityManager,
    event: ParsedPaymentEvent,
    payment: Payment,
    order: Order,
  ): Promise<DispatchResult> {
    if (
      payment.status === PaymentAttemptStatus.SUCCEEDED ||
      payment.status === PaymentAttemptStatus.REFUND_PENDING ||
      payment.status === PaymentAttemptStatus.REFUNDED
    ) {
      return { outcome: 'NOOP', refundPaymentId: null };
    }

    if (
      event.amount === null ||
      event.currency === null ||
      toCents(event.amount) !== toCents(payment.amount) ||
      event.currency !== payment.currency
    ) {
      this.logger.error(
        `Payment ${payment.id}: the confirmed amount or currency differs from the expected one. Nothing was applied.`,
      );
      return { outcome: 'AMOUNT_MISMATCH', refundPaymentId: null };
    }

    const paidAt = new Date();

    if (order.status === OrderStatus.CANCELLED) {
      await manager.update(
        Payment,
        { id: payment.id },
        {
          status: PaymentAttemptStatus.REFUND_PENDING,
          paidAt,
          failureReason: null,
        },
      );

      if (order.paymentStatus === PaymentStatus.UNPAID) {
        await manager.update(
          Order,
          { id: order.id },
          { paymentStatus: PaymentStatus.REFUND_PENDING },
        );
      }

      return { outcome: 'LATE_PAYMENT', refundPaymentId: payment.id };
    }

    const alreadyPaid = await manager.count(Payment, {
      where: {
        orderId: payment.orderId,
        status: PaymentAttemptStatus.SUCCEEDED,
      },
    });

    if (alreadyPaid > 0) {
      await manager.update(
        Payment,
        { id: payment.id },
        {
          status: PaymentAttemptStatus.REFUND_PENDING,
          paidAt,
          failureReason: null,
        },
      );

      return { outcome: 'DUPLICATE_PAYMENT', refundPaymentId: payment.id };
    }

    await manager.update(
      Payment,
      { id: payment.id },
      {
        status: PaymentAttemptStatus.SUCCEEDED,
        paidAt,
        failureReason: null,
      },
    );

    await manager.update(
      Payment,
      {
        orderId: payment.orderId,
        status: PaymentAttemptStatus.PENDING,
        id: Not(payment.id),
      },
      { status: PaymentAttemptStatus.EXPIRED },
    );

    if (order.paymentStatus === PaymentStatus.UNPAID) {
      await manager.update(
        Order,
        { id: order.id },
        { paymentStatus: PaymentStatus.PAID },
      );

      order.paymentStatus = PaymentStatus.PAID;

      if (order.status === OrderStatus.PENDING) {
        await this.orderState.transition(
          manager,
          order,
          OrderStatus.CONFIRMED,
          { userId: null, isAdmin: true },
          { note: 'Paid online.' },
        );
      }
    }

    return { outcome: 'APPLIED', refundPaymentId: null };
  }

  /**
   * Handles a failed or expired attempt. Only a PENDING attempt changes.
   *
   * @param manager Entity manager of the running transaction.
   * @param payment The locked payment.
   * @param target FAILED or EXPIRED.
   * @param reason Why it failed, when the gateway says so.
   * @returns The outcome.
   */
  private async onClosed(
    manager: EntityManager,
    payment: Payment,
    target: PaymentAttemptStatus.FAILED | PaymentAttemptStatus.EXPIRED,
    reason: string | null,
  ): Promise<DispatchResult> {
    if (payment.status !== PaymentAttemptStatus.PENDING) {
      return { outcome: 'NOOP', refundPaymentId: null };
    }

    await manager.update(
      Payment,
      { id: payment.id },
      { status: target, failureReason: reason ? reason.slice(0, 300) : null },
    );

    return { outcome: 'APPLIED', refundPaymentId: null };
  }

  /**
   * Handles the gateway's confirmation that a refund was completed.
   *
   * @param manager Entity manager of the running transaction.
   * @param payment The locked payment.
   * @param order The locked order.
   * @returns The outcome.
   */
  private async onRefundSucceeded(
    manager: EntityManager,
    payment: Payment,
    order: Order,
  ): Promise<DispatchResult> {
    if (
      payment.status !== PaymentAttemptStatus.REFUND_PENDING &&
      payment.status !== PaymentAttemptStatus.SUCCEEDED
    ) {
      return { outcome: 'NOOP', refundPaymentId: null };
    }

    await this.refundService.finalize(manager, payment, order);

    return { outcome: 'APPLIED', refundPaymentId: null };
  }
}