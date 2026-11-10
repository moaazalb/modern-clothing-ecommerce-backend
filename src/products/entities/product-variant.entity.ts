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

import { Product } from './product.entity';
import { ProductColor } from './product-color.entity';
import { ProductSize } from './product-size.entity';

/**
 * Represents a purchasable combination: Product + Color + Size.
 *
 * Stock lives here only (never in products). Two composite foreign keys
 * guarantee that the color and the size belong to the same product:
 *
 *   (productId, colorId) -> product_colors(productId, colorId)
 *   (productId, sizeId)  -> product_sizes(productId, sizeId)
 *
 * sizeId is NULL for products that need no sizes (e.g. bags). PostgreSQL
 * skips a composite foreign key when one of its columns is NULL, so no
 * fake "ONE_SIZE" value is needed.
 *
 * Known gap (enforced in ProductVariantService, not in the database):
 * sizeId must be NULL if and only if the product's sizeType is NULL.
 *
 * Variants are never hard-deleted. Use isActive = false instead.
 */
@Entity('product_variants')
@Unique('uq_variants_sku', ['sku'])
@Index('idx_variants_product_color', ['productId', 'colorId'])
@Index('idx_variants_product_size', ['productId', 'sizeId'])
@Index('uq_variant_combo_sized', ['productId', 'colorId', 'sizeId'], {
  unique: true,
  where: '"sizeId" IS NOT NULL',
})
@Index('uq_variant_combo_unsized', ['productId', 'colorId'], {
  unique: true,
  where: '"sizeId" IS NULL',
})
@Check('chk_variant_stock', `"stockQuantity" >= 0`)
@Check('chk_variant_price', `"price" IS NULL OR "price" >= 0`)
@Check('chk_variant_sku', `"sku" ~ '^[A-Z0-9][A-Z0-9_-]*$'`)
export class ProductVariant {
  /**
   * Unique identifier of the variant.
   */
  @PrimaryGeneratedColumn('uuid')
  id: string;

  /**
   * Identifier of the product this variant belongs to.
   */
  @Column({ type: 'uuid' })
  productId: string;

  /**
   * Identifier of the variant's color.
   */
  @Column({ type: 'uuid' })
  colorId: string;

  /**
   * Identifier of the variant's size. NULL for products without sizes.
   */
  @Column({ type: 'uuid', nullable: true })
  sizeId: string | null;

  /**
   * Globally unique stock keeping unit.
   * Normalized to uppercase and trimmed before saving.
   */
  @Column({ type: 'varchar', length: 100 })
  sku: string;

  /**
   * Optional variant price in USD as a decimal string (e.g. "55.00").
   * NULL means the product's base price is used.
   */
  @Column({ type: 'numeric', precision: 10, scale: 2, nullable: true })
  price: string | null;

  /**
   * Units in stock. Never negative. Decrease it only with an atomic
   * UPDATE ... WHERE stockQuantity >= :qty (see design document).
   */
  @Column({ type: 'integer', default: 0 })
  stockQuantity: number;

  /**
   * Indicates whether the variant can be sold. Used instead of deleting
   * variants, because variants referenced by orders can never be removed.
   */
  @Column({ type: 'boolean', default: true })
  isActive: boolean;

  /**
   * The product that owns this variant.
   */
  @ManyToOne(() => Product, {
    nullable: false,
    onDelete: 'RESTRICT',
    onUpdate: 'NO ACTION',
  })
  @JoinColumn({
    name: 'productId',
    foreignKeyConstraintName: 'fk_variant_product',
  })
  product: Product;

  /**
   * The product-color link. Guarantees the color belongs to the product.
   */
  @ManyToOne(() => ProductColor, {
    nullable: false,
    onDelete: 'RESTRICT',
    onUpdate: 'NO ACTION',
  })
  @JoinColumn([
    {
      name: 'productId',
      referencedColumnName: 'productId',
      foreignKeyConstraintName: 'fk_variant_product_color',
    },
    { name: 'colorId', referencedColumnName: 'colorId' },
  ])
  productColor: ProductColor;

  /**
   * The product-size link. Guarantees the size belongs to the product.
   * Skipped by the database when sizeId is NULL.
   */
  @ManyToOne(() => ProductSize, {
    nullable: true,
    onDelete: 'RESTRICT',
    onUpdate: 'NO ACTION',
  })
  @JoinColumn([
    {
      name: 'productId',
      referencedColumnName: 'productId',
      foreignKeyConstraintName: 'fk_variant_product_size',
    },
    { name: 'sizeId', referencedColumnName: 'sizeId' },
  ])
  productSize: ProductSize | null;

  /**
   * Date and time when the record was created.
   */
  @CreateDateColumn({ type: 'timestamptz' })
  createdAt: Date;

  /**
   * Date and time of the last update.
   */
  @UpdateDateColumn({ type: 'timestamptz' })
  updatedAt: Date;
}