import {
  BadGatewayException,
  HttpStatus,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { DataSource } from 'typeorm';

import { fail } from '../../common/utils/http-error.util';
import { Order } from '../../orders/entities/order.entity';
import { OrderStatus } from '../../orders/enums/order-status.enum';
import { PaymentMethod } from '../../orders/enums/payment-method.enum';
import { PaymentStatus } from '../../orders/enums/payment-status.enum';
import { OrderStateService } from '../../orders/services/order-state.service';
import { PaymentResponseDto } from '../dto/payment-response.dto';
import { Payment } from '../entities/payment.entity';
import { PaymentAttemptStatus } from '../enums/payment-attempt-status.enum';
import { toPaymentResponse } from '../mappers/payment.mappers';
import { PaymentProvider } from '../providers/payment.provider';
import { readPaymentWindowMinutes } from '../utils/payment-config.util';

/**
 * Online payment service (customer operations).
 *
 * Opening a checkout session is split in three so no database lock is held
 * while the gateway is called over the network:
 * 1. a short transaction locks the order and creates (or finds) the PENDING attempt;
 * 2. the gateway is called without any transaction;
 * 3. the result is saved.
 *
 * The gateway call uses the payment id as idempotency key, so repeating
 * the request never opens two sessions for the same attempt.
 */
@Injectable()
export class PaymentsService {
  private readonly logger = new Logger(PaymentsService.name);
  private readonly windowMinutes: number;
  private readonly frontendUrl: string;

  /**
   * Injects the services this class relies on.
   *
   * @param dataSource TypeORM data source used to open transactions.
   * @param configService Provides the payment settings.
   * @param provider The payment gateway adapter.
   * @param orderState Order status machine (used for the order lock).
   */
  constructor(
    private readonly dataSource: DataSource,
    configService: ConfigService,
    private readonly provider: PaymentProvider,
    private readonly orderState: OrderStateService,
  ) {
    this.windowMinutes = readPaymentWindowMinutes(configService);
    this.frontendUrl = (
      configService.get<string>('FRONTEND_URL') ?? 'http://localhost:3000'
    ).replace(/\/+$/, '');
  }

  /**
   * Marks an attempt as failed because the gateway could not be reached.
   * It only applies while the gateway never answered (no provider id yet).
   *
   * @param paymentId Payment attempt UUID.
   */
  private async markProviderFailure(paymentId: string): Promise<void> {
    await this.dataSource
      .createQueryBuilder()
      .update(Payment)
      .set({
        status: PaymentAttemptStatus.FAILED,
        failureReason: 'PROVIDER_ERROR',
      })
      .where('"id" = :paymentId', { paymentId })
      .andWhere('"status" = :pending', { pending: PaymentAttemptStatus.PENDING })
      .andWhere('"providerPaymentId" IS NULL')
      .execute();
  }

  /**
   * Opens (or resumes) the checkout session of an online order.
   *
   * Repeating the call while an attempt is pending returns the same
   * attempt and the same checkout address.
   *
   * @param userId Customer UUID.
   * @param orderId Order UUID.
   * @returns The payment attempt with the address where the customer pays.
   * @throws NotFoundException If the order does not exist or is not the user's.
   * @throws HttpException 422 NOT_ONLINE_ORDER, 409 ORDER_NOT_PAYABLE or PAYMENT_WINDOW_EXPIRED.
   * @throws BadGatewayException If the gateway could not be reached.
   */
  async createPayment(
    userId: string,
    orderId: string,
  ): Promise<PaymentResponseDto> {
    const { payment, order } = await this.dataSource.transaction(
      async (manager) => {
        const locked = await this.orderState.lockOrder(manager, orderId, userId);

        if (locked.paymentMethod !== PaymentMethod.ONLINE) {
          fail(
            HttpStatus.UNPROCESSABLE_ENTITY,
            'NOT_ONLINE_ORDER',
            'This order is not paid online.',
          );
        }

        if (
          locked.status !== OrderStatus.PENDING ||
          locked.paymentStatus !== PaymentStatus.UNPAID
        ) {
          fail(
            HttpStatus.CONFLICT,
            'ORDER_NOT_PAYABLE',
            'This order cannot be paid anymore.',
          );
        }

        const expiresAt = new Date(
          locked.createdAt.getTime() + this.windowMinutes * 60_000,
        );

        if (expiresAt.getTime() <= Date.now()) {
          fail(
            HttpStatus.CONFLICT,
            'PAYMENT_WINDOW_EXPIRED',
            'The time to pay this order has expired.',
          );
        }

        const pending =
          (await manager.findOne(Payment, {
            where: { orderId, status: PaymentAttemptStatus.PENDING },
          })) ??
          (await manager.save(
            manager.create(Payment, {
              orderId,
              provider: this.provider.name,
              status: PaymentAttemptStatus.PENDING,
              amount: locked.total,
              currency: locked.currency,
              expiresAt,
            }),
          ));

        return { payment: pending, order: locked };
      },
    );

    if (payment.checkoutUrl) {
      return toPaymentResponse(payment);
    }

    try {
      const session = await this.provider.createCheckout({
        paymentId: payment.id,
        orderId,
        orderNumber: order.orderNumber,
        amount: payment.amount,
        currency: payment.currency,
        customerEmail: order.customerEmail,
        returnUrl: `${this.frontendUrl}/orders/${orderId}`,
        expiresAt: payment.expiresAt,
      });

      await this.dataSource.manager.update(
        Payment,
        { id: payment.id },
        {
          providerPaymentId: session.providerPaymentId,
          checkoutUrl: session.checkoutUrl,
        },
      );
    } catch (error) {
      this.logger.error(
        `Could not open a checkout session for payment ${payment.id}.`,
        error instanceof Error ? error.stack : String(error),
      );

      await this.markProviderFailure(payment.id);

      throw new BadGatewayException({
        statusCode: HttpStatus.BAD_GATEWAY,
        error: 'Bad Gateway',
        code: 'PAYMENT_PROVIDER_UNAVAILABLE',
        message: 'The payment service is unavailable. Please try again.',
      });
    }

    const saved = await this.dataSource.manager.findOneOrFail(Payment, {
      where: { id: payment.id },
    });

    return toPaymentResponse(saved);
  }

  /**
   * Returns the latest payment attempt of one of the customer's orders.
   * The frontend uses it after the customer comes back from the gateway.
   *
   * @param userId Customer UUID.
   * @param orderId Order UUID.
   * @returns The latest attempt.
   * @throws NotFoundException If the order does not exist or is not the user's.
   * @throws HttpException 404 PAYMENT_NOT_FOUND if the order has no attempt.
   */
  async getPayment(
    userId: string,
    orderId: string,
  ): Promise<PaymentResponseDto> {
    const manager = this.dataSource.manager;

    const order = await manager.findOne(Order, {
      where: { id: orderId, userId },
      select: { id: true },
    });

    if (!order) {
      throw new NotFoundException(`Order with ID ${orderId} was not found.`);
    }

    const payment = await manager.findOne(Payment, {
      where: { orderId },
      order: { createdAt: 'DESC' },
    });

    if (!payment) {
      fail(
        HttpStatus.NOT_FOUND,
        'PAYMENT_NOT_FOUND',
        'This order has no payment attempt yet.',
      );
    }

    return toPaymentResponse(payment);
  }
}