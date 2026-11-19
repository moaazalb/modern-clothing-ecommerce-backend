import { Injectable } from '@nestjs/common';
import { DataSource } from 'typeorm';

import { AdminOrderNoteDto } from '../dto/admin-order-note.dto';
import { CancelOrderDto } from '../dto/cancel-order.dto';
import { AdminOrderDetailDto } from '../dto/order-response.dto';
import { OrderStatus } from '../enums/order-status.enum';
import { OrderReadService } from './order-read.service';
import { OrderStateService, TransitionOptions } from './order-state.service';

/**
 * Admin operations that change the status of an order.
 */
@Injectable()
export class AdminOrdersService {
  /**
   * Injects the services this class relies on.
   *
   * @param dataSource TypeORM data source used to open transactions.
   * @param orderState Order status machine.
   * @param readService Order read operations.
   */
  constructor(
    private readonly dataSource: DataSource,
    private readonly orderState: OrderStateService,
    private readonly readService: OrderReadService,
  ) {}

  /**
   * Moves an order to a status as an administrator.
   *
   * @param orderId Order UUID.
   * @param adminId Administrator UUID.
   * @param target The wanted status.
   * @param options Optional reason and internal note.
   * @returns The order after the change.
   * @throws NotFoundException If the order does not exist.
   * @throws HttpException 409 INVALID_STATUS_TRANSITION if the change is not allowed.
   */
  private async apply(
    orderId: string,
    adminId: string,
    target: OrderStatus,
    options: TransitionOptions,
  ): Promise<AdminOrderDetailDto> {
    await this.dataSource.transaction(async (manager) => {
      const order = await this.orderState.lockOrder(manager, orderId);

      await this.orderState.transition(
        manager,
        order,
        target,
        { userId: adminId, isAdmin: true },
        options,
      );
    });

    return this.readService.findDetailForAdmin(orderId);
  }

  /**
   * Confirms a PENDING order.
   *
   * @param orderId Order UUID.
   * @param adminId Administrator UUID.
   * @param dto Optional internal note.
   * @returns The updated order.
   */
  confirm(
    orderId: string,
    adminId: string,
    dto: AdminOrderNoteDto,
  ): Promise<AdminOrderDetailDto> {
    return this.apply(orderId, adminId, OrderStatus.CONFIRMED, {
      note: dto.note,
    });
  }

  /**
   * Marks a CONFIRMED order as shipped.
   *
   * @param orderId Order UUID.
   * @param adminId Administrator UUID.
   * @param dto Optional internal note.
   * @returns The updated order.
   */
  ship(
    orderId: string,
    adminId: string,
    dto: AdminOrderNoteDto,
  ): Promise<AdminOrderDetailDto> {
    return this.apply(orderId, adminId, OrderStatus.SHIPPED, {
      note: dto.note,
    });
  }

  /**
   * Marks a SHIPPED order as delivered (cash on delivery: it becomes PAID).
   *
   * @param orderId Order UUID.
   * @param adminId Administrator UUID.
   * @param dto Optional internal note.
   * @returns The updated order.
   */
  deliver(
    orderId: string,
    adminId: string,
    dto: AdminOrderNoteDto,
  ): Promise<AdminOrderDetailDto> {
    return this.apply(orderId, adminId, OrderStatus.DELIVERED, {
      note: dto.note,
    });
  }

  /**
   * Cancels a PENDING or CONFIRMED order and puts the stock back.
   *
   * @param orderId Order UUID.
   * @param adminId Administrator UUID.
   * @param dto Optional reason (shown to the customer).
   * @returns The updated order.
   */
  cancel(
    orderId: string,
    adminId: string,
    dto: CancelOrderDto,
  ): Promise<AdminOrderDetailDto> {
    return this.apply(orderId, adminId, OrderStatus.CANCELLED, {
      reason: dto.reason,
    });
  }
}