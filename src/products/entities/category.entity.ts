import {
  Check,
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  OneToMany,
  PrimaryGeneratedColumn,
  Unique,
  UpdateDateColumn,
} from 'typeorm';

/**
 * Represents a hierarchical product category (e.g. Clothing > T-Shirts).
 *
 * Gender is NOT part of categories; it is a standalone product attribute.
 * Circular hierarchies cannot be prevented by a CHECK constraint alone,
 * so CategoryService must validate parent changes (see design document).
 */
@Entity('categories')
@Unique('uq_categories_slug', ['slug'])
@Index('idx_categories_parent', ['parentId'])
@Check('chk_categories_slug_format', `"slug" ~ '^[a-z0-9]+(-[a-z0-9]+)*$'`)
@Check('chk_categories_name_not_blank', `length(trim("name")) > 0`)
@Check('chk_categories_no_self_parent', `"parentId" IS NULL OR "parentId" <> "id"`)
@Check('chk_categories_sort_order', `"sortOrder" >= 0`)
export class Category {
  /**
   * Unique identifier of the category.
   */
  @PrimaryGeneratedColumn('uuid')
  id: string;

  /**
   * Display name of the category.
   */
  @Column({ type: 'varchar', length: 100 })
  name: string;

  /**
   * Globally unique URL slug (lowercase letters, digits, hyphens).
   */
  @Column({ type: 'varchar', length: 120 })
  slug: string;

  /**
   * Optional description of the category.
   */
  @Column({ type: 'text', nullable: true })
  description: string | null;

  /**
   * Identifier of the parent category. NULL for root categories.
   */
  @Column({ type: 'uuid', nullable: true })
  parentId: string | null;

  /**
   * Parent category. Deleting a category that has children is restricted.
   */
  @ManyToOne(() => Category, (category) => category.children, {
    nullable: true,
    onDelete: 'RESTRICT',
    onUpdate: 'NO ACTION',
  })
  @JoinColumn({
    name: 'parentId',
    foreignKeyConstraintName: 'fk_categories_parent',
  })
  parent: Category | null;

  /**
   * Direct child categories.
   */
  @OneToMany(() => Category, (category) => category.parent)
  children: Category[];

  /**
   * Indicates whether the category is active.
   * A disabled category hides its products (and its descendants' products)
   * in storefront queries without changing any data.
   */
  @Column({ type: 'boolean', default: true })
  isActive: boolean;

  /**
   * Manual ordering among siblings. Must be >= 0.
   */
  @Column({ type: 'integer', default: 0 })
  sortOrder: number;

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