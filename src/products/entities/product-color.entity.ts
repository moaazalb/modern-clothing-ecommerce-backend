import {
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryColumn,
} from 'typeorm';

import { Color } from './color.entity';
import { Product } from './product.entity';

/**
 * Join table that defines the colors available for each product.
 *
 * It uses a composite primary key (productId, colorId) and has no
 * separate UUID. product_variants and product_images reference this
 * table to guarantee a color belongs to the same product.
 */
@Entity('product_colors')
@Index('idx_product_colors_color', ['colorId'])
export class ProductColor {
  /**
   * Identifier of the product (part of the composite primary key).
   */
  @PrimaryColumn({ type: 'uuid' })
  productId: string;

  /**
   * Identifier of the color (part of the composite primary key).
   */
  @PrimaryColumn({ type: 'uuid' })
  colorId: string;

  /**
   * The product that owns this color.
   */
  @ManyToOne(() => Product, {
    nullable: false,
    onDelete: 'RESTRICT',
    onUpdate: 'NO ACTION',
  })
  @JoinColumn({
    name: 'productId',
    foreignKeyConstraintName: 'fk_product_colors_product',
  })
  product: Product;

  /**
   * The color linked to the product.
   */
  @ManyToOne(() => Color, {
    nullable: false,
    onDelete: 'RESTRICT',
    onUpdate: 'NO ACTION',
  })
  @JoinColumn({
    name: 'colorId',
    foreignKeyConstraintName: 'fk_product_colors_color',
  })
  color: Color;

  /**
   * Date and time when the link was created.
   */
  @CreateDateColumn({ type: 'timestamptz' })
  createdAt: Date;
}