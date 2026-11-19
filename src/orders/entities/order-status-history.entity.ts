import {
  Check,
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';

import { User } from '../../users/entities/user.entity';
import { OrderStatus } from '../enums/order-status.enum';
import { Order } from './order.entity';

/**
 * Audit trail: one row for the creation of an order and one for every
 * status change. Rows are only inserted, never updated or deleted.
 *
 * changedByUserId is set to NULL (and the row is kept) if the user who
 * made the change is deleted later.
 */
@Entity('order_status_history')
@Index('idx_order_history_order_created', ['orderId', 'createdAt'])
@Check(
  'chk_order_history_transition',
  `"fromStatus" IS NULL OR "fromStatus" <> "toStatus"`,
)
export class OrderStatusHistory {
  /**
   * Unique identifier of the history row.
   */
  @PrimaryGeneratedColumn('uuid')
  id: string;

  /**
   * Identifier of the order.
   */
  @Column({ type: 'uuid' })
  orderId: string;

  /**
   * The order this row belongs to.
   */
  @ManyToOne(() => Order, {
    nullable: false,
    onDelete: 'RESTRICT',
    onUpdate: 'NO ACTION',
  })
  @JoinColumn({
    name: 'orderId',
    foreignKeyConstraintName: 'fk_order_history_order',
  })
  order: Order;

  /**
   * Previous status. NULL for the row that records the creation.
   */
  @Column({
    type: 'enum',
    enum: OrderStatus,
    enumName: 'order_status',
    nullable: true,
  })
  fromStatus: OrderStatus | null;

  /**
   * New status.
   */
  @Column({ type: 'enum', enum: OrderStatus, enumName: 'order_status' })
  toStatus: OrderStatus;

  /**
   * Identifier of the user who made the change (NULL for the customer's own
   * creation row, or if that user was deleted).
   */
  @Column({ type: 'uuid', nullable: true })
  changedByUserId: string | null;

  /**
   * The user who made the change.
   */
  @ManyToOne(() => User, {
    nullable: true,
    onDelete: 'SET NULL',
    onUpdate: 'NO ACTION',
  })
  @JoinColumn({
    name: 'changedByUserId',
    foreignKeyConstraintName: 'fk_order_history_user',
  })
  changedBy: User | null;

  /**
   * Optional internal note. It is never shown to the customer.
   */
  @Column({ type: 'varchar', length: 300, nullable: true })
  note: string | null;

  /**
   * Date and time of the change.
   */
  @CreateDateColumn({ type: 'timestamptz' })
  createdAt: Date;
}