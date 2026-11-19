import { HttpStatus, Injectable, NotFoundException } from '@nestjs/common';
import { DataSource, SelectQueryBuilder } from 'typeorm';

import {
  buildPaginated,
  PaginatedResponseDto,
} from '../../common/dto/paginated-response.dto';
import { escapeLike } from '../../common/utils/escape-like.util';
import { fail } from '../../common/utils/http-error.util';
import { AdminOrderListQueryDto } from '../dto/admin-order-list-query.dto';
import { OrderListQueryDto } from '../dto/order-list-query.dto';
import {
  AdminOrderDetailDto,
  OrderDetailDto,
  OrderSummaryDto,
} from '../dto/order-response.dto';
import { OrderItem } from '../entities/order-item.entity';
import { OrderStatusHistory } from '../entities/order-status-history.entity';
import { Order } from '../entities/order.entity';
import {
  OrderSummaryRow,
  toAdminDetail,
  toCustomerDetail,
  toOrderSummary,
} from '../mappers/order.mappers';

/**
 * Order read operations (details and lists) for customers and admins.
 */
@Injectable()
export class OrderReadService {
  /**
   * Injects the data source.
   *
   * @param dataSource TypeORM data source.
   */
  constructor(private readonly dataSource: DataSource) {}

  /**
   * Loads the lines and the history of an order.
   *
   * @param orderId Order UUID.
   * @returns The lines and the history, oldest first.
   */
  private async loadParts(
    orderId: string,
  ): Promise<{ items: OrderItem[]; history: OrderStatusHistory[] }> {
    const manager = this.dataSource.manager;

    const [items, history] = await Promise.all([
      manager.find(OrderItem, {
        where: { orderId },
        order: { createdAt: 'ASC', id: 'ASC' },
      }),
      manager.find(OrderStatusHistory, {
        where: { orderId },
        order: { createdAt: 'ASC', id: 'ASC' },
      }),
    ]);

    return { items, history };
  }

  /**
   * Retrieves one of the customer's own orders.
   *
   * @param userId Customer UUID.
   * @param orderId Order UUID.
   * @returns The order details.
   * @throws NotFoundException If the order does not exist or belongs to another user.
   */
  async findDetailForCustomer(
    userId: string,
    orderId: string,
  ): Promise<OrderDetailDto> {
    const order = await this.dataSource.manager.findOne(Order, {
      where: { id: orderId, userId },
    });

    if (!order) {
      throw new NotFoundException(`Order with ID ${orderId} was not found.`);
    }

    const { items, history } = await this.loadParts(order.id);

    return toCustomerDetail(order, items, history);
  }

  /**
   * Retrieves any order with the customer and the full history.
   *
   * @param orderId Order UUID.
   * @returns The admin order details.
   * @throws NotFoundException If the order does not exist.
   */
  async findDetailForAdmin(orderId: string): Promise<AdminOrderDetailDto> {
    const order = await this.dataSource.manager.findOne(Order, {
      where: { id: orderId },
    });

    if (!order) {
      throw new NotFoundException(`Order with ID ${orderId} was not found.`);
    }

    const { items, history } = await this.loadParts(order.id);

    return toAdminDetail(order, items, history);
  }

  /**
   * Lists the customer's own orders, newest first.
   *
   * @param userId Customer UUID.
   * @param query Status filter and pagination.
   * @returns A page of orders.
   */
  async listForCustomer(
    userId: string,
    query: OrderListQueryDto,
  ): Promise<PaginatedResponseDto<OrderSummaryDto>> {
    const qb = this.dataSource
      .createQueryBuilder(Order, 'o')
      .where('o.userId = :userId', { userId });

    if (query.status) {
      qb.andWhere('o.status = :status', { status: query.status });
    }

    return this.runPage(qb, query.page, query.limit);
  }

  /**
   * Lists every order with filters, newest first.
   *
   * @param query Filters and pagination.
   * @returns A page of orders.
   * @throws HttpException 422 INVALID_DATE_RANGE if from is after to.
   */
  async listForAdmin(
    query: AdminOrderListQueryDto,
  ): Promise<PaginatedResponseDto<OrderSummaryDto>> {
    if (query.from && query.to && query.from > query.to) {
      fail(
        HttpStatus.UNPROCESSABLE_ENTITY,
        'INVALID_DATE_RANGE',
        'from cannot be after to.',
      );
    }

    const qb = this.dataSource.createQueryBuilder(Order, 'o');

    if (query.status) {
      qb.andWhere('o.status = :status', { status: query.status });
    }

    if (query.paymentStatus) {
      qb.andWhere('o.paymentStatus = :paymentStatus', {
        paymentStatus: query.paymentStatus,
      });
    }

    if (query.userId) {
      qb.andWhere('o.userId = :userId', { userId: query.userId });
    }

    if (query.from) {
      qb.andWhere("o.createdAt >= (CAST(:from AS timestamp) AT TIME ZONE 'UTC')", {
        from: query.from,
      });
    }

    if (query.to) {
      qb.andWhere(
        "o.createdAt < ((CAST(:to AS timestamp) + INTERVAL '1 day') AT TIME ZONE 'UTC')",
        { to: query.to },
      );
    }

    if (query.q) {
      qb.andWhere(
        `(o.orderNumber ILIKE :search OR o.customerEmail ILIKE :search
          OR o.shippingName ILIKE :search OR o.shippingPhone ILIKE :search)`,
        { search: `%${escapeLike(query.q)}%` },
      );
    }

    return this.runPage(qb, query.page, query.limit);
  }

  /**
   * Counts the matches of a filtered query and reads one page of summaries.
   *
   * @param qb Query with the filters already applied.
   * @param page Page number.
   * @param limit Items per page.
   * @returns The page.
   */
  private async runPage(
    qb: SelectQueryBuilder<Order>,
    page: number,
    limit: number,
  ): Promise<PaginatedResponseDto<OrderSummaryDto>> {
    const total = await qb.getCount();

    if (total === 0) {
      return buildPaginated([], 0, page, limit);
    }

    const rows = await qb
      .select('o.id', 'id')
      .addSelect('o.orderNumber', 'orderNumber')
      .addSelect('o.status', 'status')
      .addSelect('o.paymentStatus', 'paymentStatus')
      .addSelect('o.total', 'total')
      .addSelect('o.currency', 'currency')
      .addSelect('o.createdAt', 'createdAt')
      .addSelect(
        'COALESCE((SELECT SUM(oi."quantity") FROM "order_items" oi WHERE oi."orderId" = "o"."id"), 0)',
        'itemCount',
      )
      .orderBy('o.createdAt', 'DESC')
      .addOrderBy('o.id', 'DESC')
      .limit(limit)
      .offset((page - 1) * limit)
      .getRawMany<OrderSummaryRow>();

    return buildPaginated(
      rows.map((row) => toOrderSummary(row)),
      total,
      page,
      limit,
    );
  }
}