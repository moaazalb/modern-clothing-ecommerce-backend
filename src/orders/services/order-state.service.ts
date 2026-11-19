import { HttpStatus, Injectable, NotFoundException } from '@nestjs/common';
import { EntityManager } from 'typeorm';

import { fail } from '../../common/utils/http-error.util';
import { OrderItem } from '../entities/order-item.entity';
import { OrderStatusHistory } from '../entities/order-status-history.entity';
import { Order } from '../entities/order.entity';
import { OrderStatus } from '../enums/order-status.enum';
import { PaymentMethod } from '../enums/payment-method.enum';
import { PaymentStatus } from '../enums/payment-status.enum';

/**
 * Status changes an administrator may make. DELIVERED and CANCELLED are final.
 * A customer may only move a PENDING order to CANCELLED.
 */
export const ADMIN_TRANSITIONS: Readonly<
  Record<OrderStatus, readonly OrderStatus[]>
> = {
  [OrderStatus.PENDING]: [OrderStatus.CONFIRMED, OrderStatus.CANCELLED],
  [OrderStatus.CONFIRMED]: [OrderStatus.SHIPPED, OrderStatus.CANCELLED],
  [OrderStatus.SHIPPED]: [OrderStatus.DELIVERED],
  [OrderStatus.DELIVERED]: [],
  [OrderStatus.CANCELLED]: [],
};

/**
 * Statuses that need the money first when the order is paid online.
 */
const REQUIRES_PAYMENT: readonly OrderStatus[] = [
  OrderStatus.CONFIRMED,
  OrderStatus.SHIPPED,
  OrderStatus.DELIVERED,
];

/**
 * Who changes the status of an order. userId is null when the system
 * itself makes the change (payment confirmed, payment expired).
 */
export interface OrderActor {
  userId: string | null;
  isAdmin: boolean;
}

/**
 * Optional details of a status change.
 *
 * reason: shown to the customer, stored when cancelling.
 * note: internal, stored in the history only.
 */
export interface TransitionOptions {
  note?: string;
  reason?: string;
}

/**
 * The order status machine, shared by the customer, admin and payment flows.
 *
 * Every change must run inside a transaction that locked the order row
 * first (see lockOrder), so two concurrent changes of the same order run
 * one after the other.
 */
@Injectable()
export class OrderStateService {
  /**
   * Locks an order row for the rest of the transaction.
   *
   * @param manager Entity manager of the running transaction.
   * @param orderId Order UUID.
   * @param userId When given, the order must belong to this user.
   * @returns The locked order (the latest committed version).
   * @throws NotFoundException If the order does not exist (or is not the user's).
   */
  async lockOrder(
    manager: EntityManager,
    orderId: string,
    userId?: string,
  ): Promise<Order> {
    const where = userId ? { id: orderId, userId } : { id: orderId };

    const order = await manager.findOne(Order, {
      where,
      lock: { mode: 'pessimistic_write' },
    });

    if (!order) {
      throw new NotFoundException(`Order with ID ${orderId} was not found.`);
    }

    return order;
  }

  /**
   * Moves a locked order to a new status.
   *
   * Moving to the current status changes nothing (it is safe to repeat).
   * An order paid online cannot be confirmed, shipped or delivered before
   * the payment arrives. Cancelling puts the stock back, and marks a paid
   * online order as REFUND_PENDING. Delivering a cash-on-delivery order
   * marks it as paid. Every real change writes a history row.
   *
   * @param manager Entity manager of the running transaction.
   * @param order The locked order.
   * @param target The wanted status.
   * @param actor Who makes the change.
   * @param options Optional reason and internal note.
   * @throws HttpException 409 INVALID_STATUS_TRANSITION or PAYMENT_REQUIRED.
   */
  async transition(
    manager: EntityManager,
    order: Order,
    target: OrderStatus,
    actor: OrderActor,
    options: TransitionOptions = {},
  ): Promise<void> {
    if (order.status === target) {
      return;
    }

    const allowed = actor.isAdmin
      ? ADMIN_TRANSITIONS[order.status].includes(target)
      : order.status === OrderStatus.PENDING &&
        target === OrderStatus.CANCELLED;

    if (!allowed) {
      fail(
        HttpStatus.CONFLICT,
        'INVALID_STATUS_TRANSITION',
        actor.isAdmin
          ? `An order cannot move from ${order.status} to ${target}.`
          : 'Only a PENDING order can be cancelled by the customer.',
      );
    }

    if (
      order.paymentMethod === PaymentMethod.ONLINE &&
      order.paymentStatus === PaymentStatus.UNPAID &&
      REQUIRES_PAYMENT.includes(target)
    ) {
      fail(
        HttpStatus.CONFLICT,
        'PAYMENT_REQUIRED',
        'The order must be paid online before it can be processed.',
      );
    }

    if (target === OrderStatus.CANCELLED) {
      await this.restoreStock(manager, order.id);
    }

    const changes: Partial<
      Pick<Order, 'status' | 'cancelledAt' | 'cancelReason' | 'paymentStatus'>
    > = { status: target };

    if (target === OrderStatus.CANCELLED) {
      changes.cancelledAt = new Date();
      changes.cancelReason = options.reason ?? null;

      if (
        order.paymentMethod === PaymentMethod.ONLINE &&
        order.paymentStatus === PaymentStatus.PAID
      ) {
        changes.paymentStatus = PaymentStatus.REFUND_PENDING;
      }
    }

    if (
      target === OrderStatus.DELIVERED &&
      order.paymentMethod === PaymentMethod.COD
    ) {
      changes.paymentStatus = PaymentStatus.PAID;
    }

    await manager.update(Order, { id: order.id }, changes);

    await manager.insert(OrderStatusHistory, {
      orderId: order.id,
      fromStatus: order.status,
      toStatus: target,
      changedByUserId: actor.userId,
      note: options.note ?? options.reason ?? null,
    });
  }

  /**
   * Puts the stock of every line of an order back. The variants are updated
   * in a fixed order (by id), the same order the checkout uses, so
   * concurrent operations cannot deadlock.
   *
   * @param manager Entity manager of the running transaction.
   * @param orderId Order UUID.
   */
  private async restoreStock(
    manager: EntityManager,
    orderId: string,
  ): Promise<void> {
    const items = await manager.find(OrderItem, {
      where: { orderId },
      select: { variantId: true, quantity: true },
      order: { variantId: 'ASC' },
    });

    for (const item of items) {
      await manager.query(
        `UPDATE "product_variants"
         SET "stockQuantity" = "stockQuantity" + $2, "updatedAt" = now()
         WHERE "id" = $1`,
        [item.variantId, item.quantity],
      );
    }
  }
}