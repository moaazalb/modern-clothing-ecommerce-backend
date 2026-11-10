import {
  Check,
  Column,
  CreateDateColumn,
  DeleteDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  Unique,
  UpdateDateColumn,
} from 'typeorm';

import { ProductGender, ProductStatus, SizeType  } from '../enums/product.enum';
import { Brand } from './brand.entity';
import { Category } from './category.entity';

/**
 * Represents the main product record (basic product information).
 *
 * Purchasable combinations (color + size), stock and optional variant
 * prices live in product_variants, not here.
 *
 * Products are never hard-deleted: deletedAt provides soft delete.
 */
@Entity('products')
@Unique('uq_products_slug', ['slug'])
@Unique('uq_products_id_sizetype', ['id', 'sizeType'])
@Index('idx_products_category', ['categoryId'])
@Index('idx_products_brand', ['brandId'])
@Index('idx_products_storefront', ['status', 'gender', 'createdAt'], {
  where: '"deletedAt" IS NULL',
})
@Check('chk_products_price', `"price" >= 0`)
@Check('chk_products_active_price', `"status" <> 'ACTIVE' OR "price" > 0`)
@Check('chk_products_slug_format', `"slug" ~ '^[a-z0-9]+(-[a-z0-9]+)*$'`)
@Check('chk_products_name_not_blank', `length(trim("name")) > 0`)
export class Product {
  /**
   * Unique identifier of the product.
   */
  @PrimaryGeneratedColumn('uuid')
  id: string;

  /**
   * Product name.
   */
  @Column({ type: 'varchar', length: 200 })
  name: string;

  /**
   * Globally unique URL slug. It also stays reserved for soft-deleted
   * products, and is not changed automatically when the name changes.
   */
  @Column({ type: 'varchar', length: 220 })
  slug: string;

  /**
   * Optional full description.
   */
  @Column({ type: 'text', nullable: true })
  description: string | null;

  /**
   * Optional short description.
   */
  @Column({ type: 'varchar', length: 300, nullable: true })
  shortDescription: string | null;

  /**
   * Base price in USD as a decimal string (e.g. "55.00").
   * Kept as a string to avoid floating-point precision loss.
   */
  @Column({ type: 'numeric', precision: 10, scale: 2 })
  price: string;

  /**
   * Identifier of the product category.
   */
  @Column({ type: 'uuid' })
  categoryId: string;

  /**
   * Category of the product. Deleting a used category is restricted.
   */
  @ManyToOne(() => Category, {
    nullable: false,
    onDelete: 'RESTRICT',
    onUpdate: 'NO ACTION',
  })
  @JoinColumn({
    name: 'categoryId',
    foreignKeyConstraintName: 'fk_products_category',
  })
  category: Category;

  /**
   * Identifier of the optional brand.
   */
  @Column({ type: 'uuid', nullable: true })
  brandId: string | null;

  /**
   * Optional brand of the product. Deleting a used brand is restricted.
   */
  @ManyToOne(() => Brand, {
    nullable: true,
    onDelete: 'RESTRICT',
    onUpdate: 'NO ACTION',
  })
  @JoinColumn({
    name: 'brandId',
    foreignKeyConstraintName: 'fk_products_brand',
  })
  brand: Brand | null;

  /**
   * Target gender. A standalone attribute, not part of categories.
   * Uses the shared PostgreSQL enum type "product_gender".
   */
  @Column({ type: 'enum', enum: ProductGender, enumName: 'product_gender' })
  gender: ProductGender;

  /**
   * Sizing system used by the product. NULL means the product needs no
   * sizes (e.g. bags). Uses the shared PostgreSQL enum type "size_type".
   */
  @Column({
    type: 'enum',
    enum: SizeType,
    enumName: 'size_type',
    nullable: true,
  })
  sizeType: SizeType | null;

  /**
   * Publication status. ACTIVE does not mean the product is in stock.
   * Uses the shared PostgreSQL enum type "product_status".
   */
  @Column({
    type: 'enum',
    enum: ProductStatus,
    enumName: 'product_status',
    default: ProductStatus.DRAFT,
  })
  status: ProductStatus;

  /**
   * Marks the product as featured for the home page.
   */
  @Column({ type: 'boolean', default: false })
  isFeatured: boolean;

  /**
   * Optional SEO title (maximum 70 characters).
   */
  @Column({ type: 'varchar', length: 70, nullable: true })
  metaTitle: string | null;

  /**
   * Optional SEO description (maximum 160 characters).
   */
  @Column({ type: 'varchar', length: 160, nullable: true })
  metaDescription: string | null;

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

  /**
   * Soft delete marker. NULL means the product is not deleted.
   * Restoring a product sets it back to NULL (and status to DRAFT).
   */
  @DeleteDateColumn({ type: 'timestamptz', nullable: true })
  deletedAt: Date | null;
}