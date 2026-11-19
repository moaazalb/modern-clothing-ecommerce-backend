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

import { ProductVariant } from '../../products/entities/product-variant.entity';
import { Cart } from './cart.entity';

/**
 * A line of a cart: one variant and its quantity.
 *
 * No price is stored: it is always computed from the variant (or product)
 * price, so price changes apply automatically. The price snapshot is taken
 * by the order, not by the cart.
 */
@Entity('cart_items')
@Unique('uq_cart_items_cart_variant', ['cartId', 'variantId'])
@Index('idx_cart_items_variant', ['variantId'])
@Check('chk_cart_items_quantity', `"quantity" > 0 AND "quantity" <= 100`)
export class CartItem {
  /**
   * Unique identifier of the cart item.
   */
  @PrimaryGeneratedColumn('uuid')
  id: string;

  /**
   * Identifier of the cart.
   */
  @Column({ type: 'uuid' })
  cartId: string;

  /**
   * Identifier of the variant.
   */
  @Column({ type: 'uuid' })
  variantId: string;

  /**
   * Quantity of the variant. The business limit is enforced by CartService.
   */
  @Column({ type: 'integer' })
  quantity: number;

  /**
   * The cart that owns this item. Deleting the cart deletes its items.
   */
  @ManyToOne(() => Cart, {
    nullable: false,
    onDelete: 'CASCADE',
    onUpdate: 'NO ACTION',
  })
  @JoinColumn({
    name: 'cartId',
    foreignKeyConstraintName: 'fk_cart_items_cart',
  })
  cart: Cart;

  /**
   * The variant in the cart. Variants are never deleted, so this is restricted.
   */
  @ManyToOne(() => ProductVariant, {
    nullable: false,
    onDelete: 'RESTRICT',
    onUpdate: 'NO ACTION',
  })
  @JoinColumn({
    name: 'variantId',
    foreignKeyConstraintName: 'fk_cart_items_variant',
  })
  variant: ProductVariant;

  /**
   * Date and time when the item was added.
   */
  @CreateDateColumn({ type: 'timestamptz' })
  createdAt: Date;

  /**
   * Date and time of the last change to the item.
   */
  @UpdateDateColumn({ type: 'timestamptz' })
  updatedAt: Date;
}