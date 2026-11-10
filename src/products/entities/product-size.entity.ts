import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryColumn,
} from 'typeorm';

import { SizeType } from '../enums/product.enum';
import { Product } from './product.entity';
import { Size } from './size.entity';

/**
 * Join table that defines the sizes available for each product.
 *
 * The sizeType column duplicates the size's type on purpose. Two composite
 * foreign keys use it to enforce, inside the database, that a size can only
 * be linked to a product with the same size type:
 *
 *   (sizeId, sizeType)    -> sizes(id, sizeType)
 *   (productId, sizeType) -> products(id, sizeType)
 *
 * A product with sizeType = NULL (e.g. bags) can never receive sizes,
 * because this column is NOT NULL.
 */
@Entity('product_sizes')
@Index('idx_product_sizes_size', ['sizeId'])
export class ProductSize {
  /**
   * Identifier of the product (part of the composite primary key).
   */
  @PrimaryColumn({ type: 'uuid' })
  productId: string;

  /**
   * Identifier of the size (part of the composite primary key).
   */
  @PrimaryColumn({ type: 'uuid' })
  sizeId: string;

  /**
   * Sizing system of the size and of the product.
   * Uses the shared PostgreSQL enum type "size_type".
   */
  @Column({ type: 'enum', enum: SizeType, enumName: 'size_type' })
  sizeType: SizeType;

  /**
   * The product that owns this size. The composite key makes the database
   * reject sizes whose type differs from the product's size type.
   */
  @ManyToOne(() => Product, {
    nullable: false,
    onDelete: 'RESTRICT',
    onUpdate: 'NO ACTION',
  })
  @JoinColumn([
    {
      name: 'productId',
      referencedColumnName: 'id',
      foreignKeyConstraintName: 'fk_ps_product_type',
    },
    { name: 'sizeType', referencedColumnName: 'sizeType' },
  ])
  product: Product;

  /**
   * The size linked to the product. The composite key keeps the stored
   * sizeType identical to the type of the referenced size.
   */
  @ManyToOne(() => Size, {
    nullable: false,
    onDelete: 'RESTRICT',
    onUpdate: 'NO ACTION',
  })
  @JoinColumn([
    {
      name: 'sizeId',
      referencedColumnName: 'id',
      foreignKeyConstraintName: 'fk_ps_size_type',
    },
    { name: 'sizeType', referencedColumnName: 'sizeType' },
  ])
  size: Size;

  /**
   * Date and time when the link was created.
   */
  @CreateDateColumn({ type: 'timestamptz' })
  createdAt: Date;
}