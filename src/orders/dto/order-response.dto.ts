import { ApiProperty, ApiPropertyOptional, OmitType } from '@nestjs/swagger';

import { OrderStatus } from '../enums/order-status.enum';
import { PaymentMethod } from '../enums/payment-method.enum';
import { PaymentStatus } from '../enums/payment-status.enum';

/**
 * A line of an order (a frozen snapshot of what was bought).
 */
export class OrderItemResponseDto {
  /**
   * Order line identifier.
   */
  @ApiProperty({ format: 'uuid' })
  id: string;

  /**
   * Variant identifier (reference only).
   */
  @ApiProperty({ format: 'uuid' })
  variantId: string;

  /**
   * Product name at purchase time.
   */
  @ApiProperty({ example: 'Classic Cotton Hoodie' })
  productName: string;

  /**
   * Variant sku at purchase time.
   */
  @ApiProperty({ example: 'HD-BLK-M' })
  sku: string;

  /**
   * Color name at purchase time.
   */
  @ApiProperty({ example: 'Black' })
  colorName: string;

  /**
   * Size name at purchase time. NULL for products without sizes.
   */
  @ApiPropertyOptional({ type: String, nullable: true })
  sizeName: string | null;

  /**
   * Size code at purchase time. NULL for products without sizes.
   */
  @ApiPropertyOptional({ type: String, nullable: true })
  sizeCode: string | null;

  /**
   * Price of one unit at purchase time, in USD.
   */
  @ApiProperty({ example: '55.00' })
  unitPrice: string;

  /**
   * Purchased quantity.
   */
  @ApiProperty({ example: 2 })
  quantity: number;

  /**
   * unitPrice multiplied by quantity, in USD.
   */
  @ApiProperty({ example: '110.00' })
  lineTotal: string;
}

/**
 * Delivery details of an order.
 */
export class OrderShippingDto {
  /**
   * Name of the person who receives the order.
   */
  @ApiProperty({ example: 'Moaaz Albari' })
  name: string;

  /**
   * Contact phone number.
   */
  @ApiProperty({ example: '+963912345678' })
  phone: string;

  /**
   * Two-letter ISO country code.
   */
  @ApiProperty({ example: 'SY' })
  country: string;

  /**
   * Delivery city.
   */
  @ApiProperty({ example: 'Damascus' })
  city: string;

  /**
   * Delivery address.
   */
  @ApiProperty({ example: 'Al-Mazzeh, Street 12, Building 4' })
  address: string;

  /**
   * Optional delivery instructions.
   */
  @ApiPropertyOptional({ type: String, nullable: true })
  notes: string | null;
}

/**
 * A status change as shown to the customer.
 */
export class OrderStatusEntryDto {
  /**
   * The status the order moved to.
   */
  @ApiProperty({ enum: OrderStatus, enumName: 'OrderStatus' })
  status: OrderStatus;

  /**
   * When the order moved to that status.
   */
  @ApiProperty({ type: String, format: 'date-time' })
  createdAt: Date;
}

/**
 * An order in a list.
 */
export class OrderSummaryDto {
  /**
   * Order identifier.
   */
  @ApiProperty({ format: 'uuid' })
  id: string;

  /**
   * Human-readable order number.
   */
  @ApiProperty({ example: 'MC-7K3F9Q2X' })
  orderNumber: string;

  /**
   * Current status.
   */
  @ApiProperty({ enum: OrderStatus, enumName: 'OrderStatus' })
  status: OrderStatus;

  /**
   * Payment state.
   */
  @ApiProperty({ enum: PaymentStatus, enumName: 'PaymentStatus' })
  paymentStatus: PaymentStatus;

  /**
   * Amount to pay, in the order currency.
   */
  @ApiProperty({ example: '115.00' })
  total: string;

  /**
   * Currency of the order.
   */
  @ApiProperty({ example: 'USD' })
  currency: string;

  /**
   * Total number of units in the order.
   */
  @ApiProperty({ example: 3 })
  itemCount: number;

  /**
   * When the order was placed.
   */
  @ApiProperty({ type: String, format: 'date-time' })
  createdAt: Date;
}

/**
 * Full order details as shown to the customer.
 */
export class OrderDetailDto {
  /**
   * Order identifier.
   */
  @ApiProperty({ format: 'uuid' })
  id: string;

  /**
   * Human-readable order number.
   */
  @ApiProperty({ example: 'MC-7K3F9Q2X' })
  orderNumber: string;

  /**
   * Current status.
   */
  @ApiProperty({ enum: OrderStatus, enumName: 'OrderStatus' })
  status: OrderStatus;

  /**
   * Payment method.
   */
  @ApiProperty({ enum: PaymentMethod, enumName: 'PaymentMethod' })
  paymentMethod: PaymentMethod;

  /**
   * Payment state.
   */
  @ApiProperty({ enum: PaymentStatus, enumName: 'PaymentStatus' })
  paymentStatus: PaymentStatus;

  /**
   * Currency of every amount.
   */
  @ApiProperty({ example: 'USD' })
  currency: string;

  /**
   * Sum of the item totals.
   */
  @ApiProperty({ example: '110.00' })
  subtotal: string;

  /**
   * Shipping fee.
   */
  @ApiProperty({ example: '5.00' })
  shippingFee: string;

  /**
   * Amount to pay (subtotal + shippingFee).
   */
  @ApiProperty({ example: '115.00' })
  total: string;

  /**
   * Delivery details.
   */
  @ApiProperty({ type: () => OrderShippingDto })
  shipping: OrderShippingDto;

  /**
   * Note from the customer.
   */
  @ApiPropertyOptional({ type: String, nullable: true })
  customerNote: string | null;

  /**
   * Purchased lines.
   */
  @ApiProperty({ type: () => [OrderItemResponseDto] })
  items: OrderItemResponseDto[];

  /**
   * Status timeline, oldest first.
   */
  @ApiProperty({ type: () => [OrderStatusEntryDto] })
  statusHistory: OrderStatusEntryDto[];

  /**
   * When the order was cancelled. NULL for orders that are not cancelled.
   */
  @ApiPropertyOptional({ type: String, format: 'date-time', nullable: true })
  cancelledAt: Date | null;

  /**
   * Reason of the cancellation.
   */
  @ApiPropertyOptional({ type: String, nullable: true })
  cancelReason: string | null;

  /**
   * When the order was placed.
   */
  @ApiProperty({ type: String, format: 'date-time' })
  createdAt: Date;

  /**
   * Last change to the order.
   */
  @ApiProperty({ type: String, format: 'date-time' })
  updatedAt: Date;
}

/**
 * The customer of an order, as shown to admins.
 */
export class AdminOrderCustomerDto {
  /**
   * Customer identifier.
   */
  @ApiProperty({ format: 'uuid' })
  userId: string;

  /**
   * Customer email at the time of the order.
   */
  @ApiProperty({ example: 'moaaz@example.com' })
  email: string;
}

/**
 * A status change as shown to admins (with the author and the internal note).
 */
export class AdminOrderStatusEntryDto {
  /**
   * Previous status. NULL for the creation row.
   */
  @ApiPropertyOptional({
    enum: OrderStatus,
    enumName: 'OrderStatus',
    nullable: true,
  })
  fromStatus: OrderStatus | null;

  /**
   * New status.
   */
  @ApiProperty({ enum: OrderStatus, enumName: 'OrderStatus' })
  toStatus: OrderStatus;

  /**
   * User who made the change. NULL for the creation row or a deleted user.
   */
  @ApiPropertyOptional({ type: String, format: 'uuid', nullable: true })
  changedByUserId: string | null;

  /**
   * Internal note (never shown to the customer).
   */
  @ApiPropertyOptional({ type: String, nullable: true })
  note: string | null;

  /**
   * When the change happened.
   */
  @ApiProperty({ type: String, format: 'date-time' })
  createdAt: Date;
}

/**
 * Full order details as shown to admins.
 */
export class AdminOrderDetailDto extends OmitType(OrderDetailDto, [
  'statusHistory',
] as const) {
  /**
   * The customer.
   */
  @ApiProperty({ type: () => AdminOrderCustomerDto })
  customer: AdminOrderCustomerDto;

  /**
   * Full status history, oldest first.
   */
  @ApiProperty({ type: () => [AdminOrderStatusEntryDto] })
  statusHistory: AdminOrderStatusEntryDto[];
}