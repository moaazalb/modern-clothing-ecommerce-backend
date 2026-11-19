import {
  Check,
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  Unique,
  UpdateDateColumn,
} from 'typeorm';

import { User } from '../../users/entities/user.entity';
import { OrderStatus } from '../enums/order-status.enum';
import { PaymentMethod } from '../enums/payment-method.enum';
import { PaymentStatus } from '../enums/payment-status.enum';

/**
 * A customer order.
 *
 * An order is immutable after creation: its amounts, items and shipping
 * address never change. Only the status, the payment status and the
 * cancellation fields change. Orders are never deleted.
 *
 * The database enforces the money rule (total = subtotal + shippingFee),
 * the cancellation rule (cancelledAt is set if and only if the status is
 * CANCELLED), and the uniqueness of the order number and of the
 * idempotency key per user.
 *
 * The entity has no OneToMany relations on purpose: items and history are
 * always loaded and written explicitly.
 */
@Entity('orders')
@Unique('uq_orders_order_number', ['orderNumber'])
@Unique('uq_orders_user_idempotency', ['userId', 'idempotencyKey'])
@Index('idx_orders_user_created', ['userId', 'createdAt'])
@Index('idx_orders_status_created', ['status', 'createdAt'])
@Check(
  'chk_orders_amounts',
  `"subtotal" >= 0 AND "shippingFee" >= 0 AND "total" = "subtotal" + "shippingFee"`,
)
@Check(
  'chk_orders_cancelled',
  `("status" = 'CANCELLED') = ("cancelledAt" IS NOT NULL)`,
)
@Check('chk_orders_order_number', `"orderNumber" ~ '^MC-[A-Z0-9]{8}$'`)
@Check('chk_orders_currency', `"currency" ~ '^[A-Z]{3}$'`)
@Check('chk_orders_country', `"shippingCountry" ~ '^[A-Z]{2}$'`)
@Check('chk_orders_phone', `"shippingPhone" ~ '^[+]?[0-9]{7,15}$'`)
@Check(
  'chk_orders_shipping_text',
  `length(trim("shippingName")) > 0 AND length(trim("shippingCity")) > 0 AND length(trim("shippingAddress")) > 0`,
)
export class Order {
  /**
   * Unique identifier of the order.
   */
  @PrimaryGeneratedColumn('uuid')
  id: string;

  /**
   * Human-readable random order number (MC-XXXXXXXX). It is not sequential,
   * so it does not reveal how many orders the store has.
   */
  @Column({ type: 'varchar', length: 20 })
  orderNumber: string;

  /**
   * Identifier of the customer who placed the order.
   */
  @Column({ type: 'uuid' })
  userId: string;

  /**
   * The customer. A user who has orders cannot be deleted.
   */
  @ManyToOne(() => User, {
    nullable: false,
    onDelete: 'RESTRICT',
    onUpdate: 'NO ACTION',
  })
  @JoinColumn({ name: 'userId', foreignKeyConstraintName: 'fk_orders_user' })
  user: User;

  /**
   * Current status. Uses the shared PostgreSQL enum type "order_status".
   */
  @Column({
    type: 'enum',
    enum: OrderStatus,
    enumName: 'order_status',
    default: OrderStatus.PENDING,
  })
  status: OrderStatus;

  /**
   * Payment method. Uses the shared PostgreSQL enum type "payment_method".
   */
  @Column({
    type: 'enum',
    enum: PaymentMethod,
    enumName: 'payment_method',
    default: PaymentMethod.COD,
  })
  paymentMethod: PaymentMethod;

  /**
   * Payment state. Uses the shared PostgreSQL enum type "payment_status".
   */
  @Column({
    type: 'enum',
    enum: PaymentStatus,
    enumName: 'payment_status',
    default: PaymentStatus.UNPAID,
  })
  paymentStatus: PaymentStatus;

  /**
   * Currency of every amount of the order (a snapshot of the store currency).
   */
  @Column({ type: 'varchar', length: 3 })
  currency: string;

  /**
   * Sum of the item totals, as a decimal string.
   */
  @Column({ type: 'numeric', precision: 14, scale: 2 })
  subtotal: string;

  /**
   * Shipping fee at the time of the order, as a decimal string.
   */
  @Column({ type: 'numeric', precision: 10, scale: 2 })
  shippingFee: string;

  /**
   * Amount to pay (subtotal + shippingFee), as a decimal string.
   */
  @Column({ type: 'numeric', precision: 14, scale: 2 })
  total: string;

  /**
   * Customer email at the time of the order (a snapshot).
   */
  @Column({ type: 'varchar', length: 255 })
  customerEmail: string;

  /**
   * Name of the person who receives the order.
   */
  @Column({ type: 'varchar', length: 150 })
  shippingName: string;

  /**
   * Contact phone number (digits with an optional leading +).
   */
  @Column({ type: 'varchar', length: 20 })
  shippingPhone: string;

  /**
   * Country as a two-letter uppercase ISO code.
   */
  @Column({ type: 'varchar', length: 2 })
  shippingCountry: string;

  /**
   * Delivery city.
   */
  @Column({ type: 'varchar', length: 100 })
  shippingCity: string;

  /**
   * Delivery address.
   */
  @Column({ type: 'varchar', length: 300 })
  shippingAddress: string;

  /**
   * Optional delivery instructions.
   */
  @Column({ type: 'varchar', length: 300, nullable: true })
  shippingNotes: string | null;

  /**
   * Optional note from the customer.
   */
  @Column({ type: 'varchar', length: 500, nullable: true })
  customerNote: string | null;

  /**
   * Key sent by the client to make order creation safe to retry.
   * Unique per user.
   */
  @Column({ type: 'varchar', length: 64 })
  idempotencyKey: string;

  /**
   * When the order was cancelled. Set if and only if the status is CANCELLED.
   */
  @Column({ type: 'timestamptz', nullable: true })
  cancelledAt: Date | null;

  /**
   * Optional reason of the cancellation.
   */
  @Column({ type: 'varchar', length: 300, nullable: true })
  cancelReason: string | null;

  /**
   * Date and time when the order was created.
   */
  @CreateDateColumn({ type: 'timestamptz' })
  createdAt: Date;

  /**
   * Date and time of the last change to the order.
   */
  @UpdateDateColumn({ type: 'timestamptz' })
  updatedAt: Date;
}