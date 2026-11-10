import {
  Check,
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  Unique,
} from 'typeorm';

import { Product } from './product.entity';
import { ProductColor } from './product-color.entity';

/**
 * Represents a product image: general (colorId = NULL) or color-specific.
 *
 * Only a relative storage key is stored, never an absolute URL, so the
 * storage provider can change without touching the Product module.
 * The public URL is built by the StorageProvider at response time.
 *
 * The sort order is unique inside each group (general images, or the
 * images of one color) through "uq_images_sort". The entity declares it as
 * a plain unique constraint only so TypeORM recognizes it (the schema check
 * would otherwise drop it). In the migration it is written by hand as:
 *
 *   UNIQUE NULLS NOT DISTINCT (productId, colorId, sortOrder)
 *   DEFERRABLE INITIALLY IMMEDIATE
 *
 * NULLS NOT DISTINCT makes the NULL color form one group, and DEFERRABLE
 * lets a reorder swap positions inside one transaction (requires
 * PostgreSQL 15+). The image with sortOrder = 0 in a group is its main
 * image.
 */
@Entity('product_images')
@Unique('uq_images_storage_key', ['storageKey'])
@Unique('uq_images_sort', ['productId', 'colorId', 'sortOrder'])
@Check('chk_image_sort', `"sortOrder" >= 0`)
export class ProductImage {
  /**
   * Unique identifier of the image.
   */
  @PrimaryGeneratedColumn('uuid')
  id: string;

  /**
   * Identifier of the product the image belongs to.
   */
  @Column({ type: 'uuid' })
  productId: string;

  /**
   * Identifier of the color for color-specific images.
   * NULL for general product images.
   */
  @Column({ type: 'uuid', nullable: true })
  colorId: string | null;

  /**
   * Relative storage key (e.g. products/{productId}/{uuid}.webp).
   * Globally unique, so a file is never shared by two records.
   */
  @Column({ type: 'varchar', length: 500 })
  storageKey: string;

  /**
   * Optional alternative text for accessibility.
   */
  @Column({ type: 'varchar', length: 255, nullable: true })
  altText: string | null;

  /**
   * Position inside the image group. Must be >= 0.
   */
  @Column({ type: 'integer' })
  sortOrder: number;

  /**
   * The product that owns this image.
   */
  @ManyToOne(() => Product, {
    nullable: false,
    onDelete: 'RESTRICT',
    onUpdate: 'NO ACTION',
  })
  @JoinColumn({
    name: 'productId',
    foreignKeyConstraintName: 'fk_images_product',
  })
  product: Product;

  /**
   * The product-color link. Guarantees the color belongs to the product.
   * Skipped by the database when colorId is NULL (general image).
   */
  @ManyToOne(() => ProductColor, {
    nullable: true,
    onDelete: 'RESTRICT',
    onUpdate: 'NO ACTION',
  })
  @JoinColumn([
    {
      name: 'productId',
      referencedColumnName: 'productId',
      foreignKeyConstraintName: 'fk_image_product_color',
    },
    { name: 'colorId', referencedColumnName: 'colorId' },
  ])
  productColor: ProductColor | null;

  /**
   * Date and time when the record was created.
   */
  @CreateDateColumn({ type: 'timestamptz' })
  createdAt: Date;
}