import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { DataSource } from 'typeorm';

import { Order } from '../../orders/entities/order.entity';
import { OrderStatus } from '../../orders/enums/order-status.enum';
import { PaymentMethod } from '../../orders/enums/payment-method.enum';
import { PaymentStatus } from '../../orders/enums/payment-status.enum';
import { OrderStateService } from '../../orders/services/order-state.service';
import { PAYMENT_EXPIRY_BATCH_SIZE } from '../constants/payment.constants';
import { Payment } from '../entities/payment.entity';
import { PaymentAttemptStatus } from '../enums/payment-attempt-status.enum';
import { readPaymentWindowMinutes } from '../utils/payment-config.util';

/**
 * Online orders still unpaid after the payment window, oldest first.
 */
const EXPIRED_ORDERS_SQL = `
  SELECT "id" FROM "orders"
  WHERE "paymentMethod" = 'ONLINE'
    AND "status" = 'PENDING'
    AND "paymentStatus" = 'UNPAID'
    AND "createdAt" < now() - ($1::int * interval '1 minute')
  ORDER BY "createdAt" ASC
  LIMIT $2`;

/**
 * Cancels online orders that were not paid in time, so the stock they hold
 * goes back on sale. A payment that arrives afterwards is refunded by the
 * webhook flow.
 */
@Injectable()
export class PaymentExpiryService {
  private readonly logger = new Logger(PaymentExpiryService.name);
  private readonly windowMinutes: number;

  /**
   * Injects the services this class relies on.
   *
   * @param dataSource TypeORM data source used to open transactions.
   * @param configService Provides the payment window.
   * @param orderState Order status machine.
   */
  constructor(
    private readonly dataSource: DataSource,
    configService: ConfigService,
    private readonly orderState: OrderStateService,
  ) {
    this.windowMinutes = readPaymentWindowMinutes(configService);
  }

  /**
   * Cancels one order if it is still an unpaid online order past its
   * window. The checks are repeated under the lock, because the payment
   * may have arrived since the order was selected.
   *
   * @param orderId Order UUID.
   * @returns True if the order was cancelled.
   */
  private async expireOrder(orderId: string): Promise<boolean> {
    return this.dataSource.transaction(async (manager) => {
      const order = await this.orderState.lockOrder(manager, orderId);

      const deadline = order.createdAt.getTime() + this.windowMinutes * 60_000;

      if (
        order.paymentMethod !== PaymentMethod.ONLINE ||
        order.status !== OrderStatus.PENDING ||
        order.paymentStatus !== PaymentStatus.UNPAID ||
        deadline > Date.now()
      ) {
        return false;
      }

      await this.orderState.transition(
        manager,
        order,
        OrderStatus.CANCELLED,
        { userId: null, isAdmin: true },
        {
          reason: 'The payment was not completed in time.',
          note: 'Cancelled automatically: payment window expired.',
        },
      );

      await manager.update(
        Payment,
        { orderId, status: PaymentAttemptStatus.PENDING },
        { status: PaymentAttemptStatus.EXPIRED },
      );

      return true;
    });
  }

  /**
   * Cancels the unpaid online orders past their window (one batch), then
   * marks the remaining pending attempts past their deadline as expired.
   *
   * @returns The number of orders that were cancelled.
   */
  async run(): Promise<number> {
    const rows: { id: string }[] = await this.dataSource.query(
      EXPIRED_ORDERS_SQL,
      [this.windowMinutes, PAYMENT_EXPIRY_BATCH_SIZE],
    );

    let cancelled = 0;

    for (const row of rows) {
      try {
        if (await this.expireOrder(row.id)) {
          cancelled += 1;
        }
      } catch (error) {
        this.logger.error(
          `Could not expire order ${row.id}.`,
          error instanceof Error ? error.stack : String(error),
        );
      }
    }

    await this.dataSource.query(
      `UPDATE "payments" SET "status" = 'EXPIRED', "updatedAt" = now()
       WHERE "status" = 'PENDING' AND "expiresAt" < now()`,
    );

    return cancelled;
  }
}