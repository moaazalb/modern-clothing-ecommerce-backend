import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { DataSource, EntityManager } from 'typeorm';

import { Order } from '../../orders/entities/order.entity';
import { OrderStatus } from '../../orders/enums/order-status.enum';
import { PaymentStatus } from '../../orders/enums/payment-status.enum';
import { OrderStateService } from '../../orders/services/order-state.service';
import { REFUND_BATCH_SIZE } from '../constants/payment.constants';
import { Payment } from '../entities/payment.entity';
import { PaymentAttemptStatus } from '../enums/payment-attempt-status.enum';
import { PaymentProvider } from '../providers/payment.provider';

/**
 * Result of one refund attempt.
 *
 * REFUNDED: the money was returned.
 * PENDING: the gateway accepted the request and will confirm later.
 * FAILED: the gateway refused or could not be reached (it will be retried).
 * SKIPPED: nothing to refund (already done, or not needed).
 */
export type RefundOutcome = 'REFUNDED' | 'PENDING' | 'FAILED' | 'SKIPPED';

/**
 * Selects the payments whose money must be returned: payments already
 * marked REFUND_PENDING, and succeeded payments of cancelled orders.
 */
const REFUND_CANDIDATES_SQL = `
  SELECT p."id" AS "id"
  FROM "payments" p
  JOIN "orders" o ON o."id" = p."orderId"
  WHERE p."providerPaymentId" IS NOT NULL
    AND (
      p."status" = 'REFUND_PENDING'
      OR (p."status" = 'SUCCEEDED' AND o."status" = 'CANCELLED')
    )
  ORDER BY p."createdAt" ASC
  LIMIT $1`;

/**
 * Refund service.
 *
 * A refund is needed in three cases: a paid order was cancelled, money
 * arrived after the order was cancelled (late payment), or the customer
 * paid twice. The gateway call uses a stable idempotency key per payment,
 * so repeating a refund never returns the money twice.
 *
 * Lock order is always: the order row first, then the payment row.
 */
@Injectable()
export class PaymentRefundService {
  private readonly logger = new Logger(PaymentRefundService.name);

  /**
   * Injects the services this class relies on.
   *
   * @param dataSource TypeORM data source used to open transactions.
   * @param provider The payment gateway adapter.
   * @param orderState Order status machine (used for the order lock).
   */
  constructor(
    private readonly dataSource: DataSource,
    private readonly provider: PaymentProvider,
    private readonly orderState: OrderStateService,
  ) {}

  /**
   * Tells whether a payment still has to be refunded.
   *
   * @param payment The locked payment.
   * @param order The locked order.
   * @returns True if the money must be returned.
   */
  private needsRefund(payment: Payment, order: Order): boolean {
    return (
      payment.status === PaymentAttemptStatus.REFUND_PENDING ||
      (payment.status === PaymentAttemptStatus.SUCCEEDED &&
        order.status === OrderStatus.CANCELLED)
    );
  }

  /**
   * Records that the money was returned: the payment becomes REFUNDED, and
   * a cancelled order waiting for its refund becomes REFUNDED too.
   *
   * @param manager Entity manager of the running transaction.
   * @param payment The locked payment.
   * @param order The locked order.
   */
  async finalize(
    manager: EntityManager,
    payment: Payment,
    order: Order,
  ): Promise<void> {
    await manager.update(
      Payment,
      { id: payment.id },
      {
        status: PaymentAttemptStatus.REFUNDED,
        refundedAt: new Date(),
        refundError: null,
      },
    );

    if (
      order.status === OrderStatus.CANCELLED &&
      order.paymentStatus === PaymentStatus.REFUND_PENDING
    ) {
      await manager.update(
        Order,
        { id: order.id },
        { paymentStatus: PaymentStatus.REFUNDED },
      );
    }
  }

  /**
   * Refunds one payment if it needs it.
   *
   * @param paymentId Payment UUID.
   * @returns What happened.
   * @throws NotFoundException If the payment does not exist.
   */
  async refundOne(paymentId: string): Promise<RefundOutcome> {
    const candidate = await this.dataSource.manager.findOne(Payment, {
      where: { id: paymentId },
    });

    if (!candidate) {
      throw new NotFoundException(`Payment with ID ${paymentId} was not found.`);
    }

    return this.dataSource.transaction(async (manager) => {
      const order = await this.orderState.lockOrder(manager, candidate.orderId);

      const payment = await manager.findOne(Payment, {
        where: { id: paymentId },
        lock: { mode: 'pessimistic_write' },
      });

      if (
        !payment ||
        !payment.providerPaymentId ||
        !this.needsRefund(payment, order)
      ) {
        return 'SKIPPED';
      }

      try {
        const result = await this.provider.refund({
          providerPaymentId: payment.providerPaymentId,
          amount: payment.amount,
          currency: payment.currency,
          idempotencyKey: `refund-${payment.id}`,
        });

        if (result.status === 'SUCCEEDED') {
          await this.finalize(manager, payment, order);
          return 'REFUNDED';
        }

        await manager.update(
          Payment,
          { id: payment.id },
          { status: PaymentAttemptStatus.REFUND_PENDING, refundError: null },
        );

        return 'PENDING';
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);

        this.logger.error(
          `Refund of payment ${payment.id} failed: ${message}`,
          error instanceof Error ? error.stack : undefined,
        );

        await manager.update(
          Payment,
          { id: payment.id },
          { refundError: message.slice(0, 300) },
        );

        return 'FAILED';
      }
    });
  }

  /**
   * Refunds one payment without ever throwing (used after a webhook, where
   * a failed refund must not make the webhook fail). The refund job retries.
   *
   * @param paymentId Payment UUID.
   */
  async tryRefund(paymentId: string): Promise<void> {
    try {
      await this.refundOne(paymentId);
    } catch (error) {
      this.logger.error(
        `Could not start the refund of payment ${paymentId}.`,
        error instanceof Error ? error.stack : String(error),
      );
    }
  }

  /**
   * Refunds every payment that needs it, up to one batch.
   *
   * @returns The number of payments that were processed.
   */
  async processBatch(): Promise<number> {
    const rows: { id: string }[] = await this.dataSource.query(
      REFUND_CANDIDATES_SQL,
      [REFUND_BATCH_SIZE],
    );

    for (const row of rows) {
      await this.tryRefund(row.id);
    }

    return rows.length;
  }
}