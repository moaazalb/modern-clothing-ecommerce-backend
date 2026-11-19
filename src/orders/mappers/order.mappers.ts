import {
  AdminOrderDetailDto,
  OrderDetailDto,
  OrderItemResponseDto,
  OrderShippingDto,
  OrderSummaryDto,
} from '../dto/order-response.dto';
import { OrderItem } from '../entities/order-item.entity';
import { OrderStatusHistory } from '../entities/order-status-history.entity';
import { Order } from '../entities/order.entity';

/**
 * A raw row of the order list query.
 */
export interface OrderSummaryRow {
  id: string;
  orderNumber: string;
  status: OrderSummaryDto['status'];
  paymentStatus: OrderSummaryDto['paymentStatus'];
  total: string;
  currency: string;
  createdAt: Date;
  itemCount: string | number;
}

/**
 * Converts a list row into the summary DTO.
 *
 * @param row Raw row of the list query.
 * @returns Summary data.
 */
export function toOrderSummary(row: OrderSummaryRow): OrderSummaryDto {
  return {
    id: row.id,
    orderNumber: row.orderNumber,
    status: row.status,
    paymentStatus: row.paymentStatus,
    total: row.total,
    currency: row.currency,
    itemCount: Number(row.itemCount),
    createdAt: row.createdAt,
  };
}

/**
 * Converts an order line into its DTO.
 *
 * @param item Order line entity.
 * @returns Line data.
 */
function toItemDto(item: OrderItem): OrderItemResponseDto {
  return {
    id: item.id,
    variantId: item.variantId,
    productName: item.productName,
    sku: item.sku,
    colorName: item.colorName,
    sizeName: item.sizeName,
    sizeCode: item.sizeCode,
    unitPrice: item.unitPrice,
    quantity: item.quantity,
    lineTotal: item.lineTotal,
  };
}

/**
 * Builds the delivery details of an order.
 *
 * @param order Order entity.
 * @returns Delivery data.
 */
function toShippingDto(order: Order): OrderShippingDto {
  return {
    name: order.shippingName,
    phone: order.shippingPhone,
    country: order.shippingCountry,
    city: order.shippingCity,
    address: order.shippingAddress,
    notes: order.shippingNotes,
  };
}

/**
 * Builds the fields shared by the customer and the admin detail.
 *
 * @param order Order entity.
 * @param items Order lines.
 * @returns The common detail fields.
 */
function toCommonDetail(order: Order, items: OrderItem[]) {
  return {
    id: order.id,
    orderNumber: order.orderNumber,
    status: order.status,
    paymentMethod: order.paymentMethod,
    paymentStatus: order.paymentStatus,
    currency: order.currency,
    subtotal: order.subtotal,
    shippingFee: order.shippingFee,
    total: order.total,
    shipping: toShippingDto(order),
    customerNote: order.customerNote,
    items: items.map((item) => toItemDto(item)),
    cancelledAt: order.cancelledAt,
    cancelReason: order.cancelReason,
    createdAt: order.createdAt,
    updatedAt: order.updatedAt,
  };
}

/**
 * Builds the order details shown to the customer. The history keeps only
 * the status and the date: authors and internal notes stay hidden.
 *
 * @param order Order entity.
 * @param items Order lines.
 * @param history Status history.
 * @returns Customer detail data.
 */
export function toCustomerDetail(
  order: Order,
  items: OrderItem[],
  history: OrderStatusHistory[],
): OrderDetailDto {
  return {
    ...toCommonDetail(order, items),
    statusHistory: history.map((entry) => ({
      status: entry.toStatus,
      createdAt: entry.createdAt,
    })),
  };
}

/**
 * Builds the order details shown to admins (customer, authors and notes).
 *
 * @param order Order entity.
 * @param items Order lines.
 * @param history Status history.
 * @returns Admin detail data.
 */
export function toAdminDetail(
  order: Order,
  items: OrderItem[],
  history: OrderStatusHistory[],
): AdminOrderDetailDto {
  return {
    ...toCommonDetail(order, items),
    customer: { userId: order.userId, email: order.customerEmail },
    statusHistory: history.map((entry) => ({
      fromStatus: entry.fromStatus,
      toStatus: entry.toStatus,
      changedByUserId: entry.changedByUserId,
      note: entry.note,
      createdAt: entry.createdAt,
    })),
  };
}