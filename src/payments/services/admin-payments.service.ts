import { BadGatewayException, HttpStatus, Injectable, NotFoundException } from '@nestjs/common';
import { DataSource } from 'typeorm';

import {
  buildPaginated,
  PaginatedResponseDto,
} from '../../common/dto/paginated-response.dto';
import { fail } from '../../common/utils/http-error.util';
import { Order } from '../../orders/entities/order.entity';
import { AdminPaymentListQueryDto } from '../dto/admin-payment-list-query.dto';
import {
  AdminPaymentDetailDto,
  AdminPaymentSummaryDto,
} from '../dto/payment-response.dto';
import { PaymentEvent } from '../entities/payment-event.entity';
import { Payment } from '../entities/payment.entity';
import { PaymentAttemptStatus } from '../enums/payment-attempt-status.enum';
import {
  AdminPaymentRow,
  toAdminDetail,
  toAdminSummary,
} from '../mappers/payment.mappers';
import { PaymentRefundService } from './payment-refund.service';

/**
 * The money must be returned: marked REFUND_PENDING, or succeeded on a
 * cancelled order.
 */
const REFUND_NEEDED_SQL =
  "(p.status = 'REFUND_PENDING' OR (p.status = 'SUCCEEDED' AND o.status = 'CANCELLED'))";

/**
 * Admin operations on payments: list, details and manual refund retry.
 */
@Injectable()
export class AdminPaymentsService {
  /**
   * Injects the services this class relies on.
   *
   * @param dataSource TypeORM data source.
   * @param refundService Refund operations.
   */
  constructor(
    private readonly dataSource: DataSource,
    private readonly refundService: PaymentRefundService,
  ) {}

  /**
   * Lists payment attempts, newest first.
   *
   * @param query Filters and pagination.
   * @returns A page of payments.
   */
  async list(
    query: AdminPaymentListQueryDto,
  ): Promise<PaginatedResponseDto<AdminPaymentSummaryDto>> {
    const qb = this.dataSource
      .createQueryBuilder(Payment, 'p')
      .innerJoin(Order, 'o', 'o.id = p.orderId');

    if (query.status) {
      qb.andWhere('p.status = :status', { status: query.status });
    }

    if (query.orderId) {
      qb.andWhere('p.orderId = :orderId', { orderId: query.orderId });
    }

    if (query.refundNeeded === true) {
      qb.andWhere(REFUND_NEEDED_SQL);
    } else if (query.refundNeeded === false) {
      qb.andWhere(`NOT ${REFUND_NEEDED_SQL}`);
    }

    const total = await qb.getCount();

    if (total === 0) {
      return buildPaginated([], 0, query.page, query.limit);
    }

    const rows = await qb
      .select('p.id', 'id')
      .addSelect('p.orderId', 'orderId')
      .addSelect('o.orderNumber', 'orderNumber')
      .addSelect('p.provider', 'provider')
      .addSelect('p.status', 'status')
      .addSelect('p.amount', 'amount')
      .addSelect('p.currency', 'currency')
      .addSelect('o.paymentStatus', 'orderPaymentStatus')
      .addSelect(REFUND_NEEDED_SQL, 'refundNeeded')
      .addSelect('p.paidAt', 'paidAt')
      .addSelect('p.createdAt', 'createdAt')
      .orderBy('p.createdAt', 'DESC')
      .addOrderBy('p.id', 'DESC')
      .limit(query.limit)
      .offset((query.page - 1) * query.limit)
      .getRawMany<AdminPaymentRow>();

    return buildPaginated(
      rows.map((row) => toAdminSummary(row)),
      total,
      query.page,
      query.limit,
    );
  }

  /**
   * Retrieves a payment attempt with its order status and webhook events.
   *
   * @param paymentId Payment UUID.
   * @returns The admin detail.
   * @throws NotFoundException If the payment does not exist.
   */
  async findOne(paymentId: string): Promise<AdminPaymentDetailDto> {
    const manager = this.dataSource.manager;

    const payment = await manager.findOne(Payment, {
      where: { id: paymentId },
    });

    if (!payment) {
      throw new NotFoundException(`Payment with ID ${paymentId} was not found.`);
    }

    const [order, events] = await Promise.all([
      manager.findOneOrFail(Order, { where: { id: payment.orderId } }),
      manager.find(PaymentEvent, {
        where: { paymentId },
        order: { createdAt: 'DESC', id: 'DESC' },
      }),
    ]);

    return toAdminDetail(payment, order, events);
  }

  /**
   * Retries the refund of a payment right now.
   *
   * @param paymentId Payment UUID.
   * @returns The payment after the attempt.
   * @throws NotFoundException If the payment does not exist.
   * @throws HttpException 409 REFUND_NOT_NEEDED if there is nothing to refund.
   * @throws BadGatewayException If the gateway refused or could not be reached.
   */
  async refund(paymentId: string): Promise<AdminPaymentDetailDto> {
    const outcome = await this.refundService.refundOne(paymentId);

    if (outcome === 'SKIPPED') {
      fail(
        HttpStatus.CONFLICT,
        'REFUND_NOT_NEEDED',
        'This payment does not need a refund.',
      );
    }

    const detail = await this.findOne(paymentId);

    if (outcome === 'FAILED') {
      throw new BadGatewayException({
        statusCode: HttpStatus.BAD_GATEWAY,
        error: 'Bad Gateway',
        code: 'REFUND_FAILED',
        message: detail.refundError ?? 'The refund could not be completed.',
      });
    }

    return detail;
  }
}