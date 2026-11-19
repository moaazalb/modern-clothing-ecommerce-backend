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
} from 'typeorm';

import { ProductVariant } from '../../products/entities/product-variant.entity';
import { Order } from './order.entity';

/**
 * A line of an order: a frozen snapshot of what the customer bought.
 *
 * The names, the sku and the price are copied at purchase time, so later
 * changes to the product never change an old order. The variant is kept
 * as a reference only (variants are never deleted).
 */
@Entity('order_items')
@Unique('uq_order_items_order_variant', ['orderId', 'variantId'])
@Index('idx_order_items_variant', ['variantId'])
@Check('chk_order_items_quantity', `"quantity" > 0 AND "quantity" <= 100`)
@Check(
  'chk_order_items_amounts',
  `"unitPrice" >= 0 AND "lineTotal" = "unitPrice" * "quantity"`,
)
export class OrderItem {
  /**
   * Unique identifier of the order line.
   */
  @PrimaryGeneratedColumn('uuid')
  id: string;

  /**
   * Identifier of the order.
   */
  @Column({ type: 'uuid' })
  orderId: string;

  /**
   * The order that owns this line.
   */
  @ManyToOne(() => Order, {
    nullable: false,
    onDelete: 'RESTRICT',
    onUpdate: 'NO ACTION',
  })
  @JoinColumn({
    name: 'orderId',
    foreignKeyConstraintName: 'fk_order_items_order',
  })
  order: Order;

  /**
   * Identifier of the purchased variant.
   */
  @Column({ type: 'uuid' })
  variantId: string;

  /**
   * The purchased variant (reference only).
   */
  @ManyToOne(() => ProductVariant, {
    nullable: false,
    onDelete: 'RESTRICT',
    onUpdate: 'NO ACTION',
  })
  @JoinColumn({
    name: 'variantId',
    foreignKeyConstraintName: 'fk_order_items_variant',
  })
  variant: ProductVariant;

  /**
   * Product name at purchase time.
   */
  @Column({ type: 'varchar', length: 200 })
  productName: string;

  /**
   * Variant sku at purchase time.
   */
  @Column({ type: 'varchar', length: 100 })
  sku: string;

  /**
   * Color name at purchase time.
   */
  @Column({ type: 'varchar', length: 50 })
  colorName: string;

  /**
   * Size name at purchase time. NULL for products without sizes.
   */
  @Column({ type: 'varchar', length: 20, nullable: true })
  sizeName: string | null;

  /**
   * Size code at purchase time. NULL for products without sizes.
   */
  @Column({ type: 'varchar', length: 20, nullable: true })
  sizeCode: string | null;

  /**
   * Price of one unit at purchase time, as a decimal string.
   */
  @Column({ type: 'numeric', precision: 10, scale: 2 })
  unitPrice: string;

  /**
   * Purchased quantity.
   */
  @Column({ type: 'integer' })
  quantity: number;

  /**
   * unitPrice multiplied by quantity, as a decimal string.
   */
  @Column({ type: 'numeric', precision: 14, scale: 2 })
  lineTotal: string;

  /**
   * Date and time when the line was created.
   */
  @CreateDateColumn({ type: 'timestamptz' })
  createdAt: Date;
}