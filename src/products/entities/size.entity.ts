import {
  Check,
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  Unique,
  UpdateDateColumn,
} from 'typeorm';

import { SizeType } from '../enums/product.enum';

/**
 * Central dictionary of sizes for both sizing systems (APPAREL / FOOTWEAR).
 *
 * The same code may exist in two systems, so uniqueness is on (code, sizeType).
 * "uq_sizes_id_sizetype" looks redundant next to the primary key, but it is
 * the target of the composite foreign key from product_sizes that guarantees
 * a size can only be linked to a product of the same size type.
 */
@Entity('sizes')
@Unique('uq_sizes_code_type', ['code', 'sizeType'])
@Unique('uq_sizes_name_type', ['name', 'sizeType'])
@Unique('uq_sizes_id_sizetype', ['id', 'sizeType'])
@Index('idx_sizes_type_active_sort', ['sizeType', 'isActive', 'sortOrder'])
@Check('chk_sizes_sort_order', `"sortOrder" >= 0`)
export class Size {
  /**
   * Unique identifier of the size.
   */
  @PrimaryGeneratedColumn('uuid')
  id: string;

  /**
   * Display name (e.g. Small, Size 42).
   */
  @Column({ type: 'varchar', length: 20 })
  name: string;

  /**
   * Short code (e.g. S, 42). Unique together with sizeType.
   */
  @Column({ type: 'varchar', length: 20 })
  code: string;

  /**
   * Sizing system this size belongs to.
   * Uses the shared PostgreSQL enum type "size_type".
   */
  @Column({ type: 'enum', enum: SizeType, enumName: 'size_type' })
  sizeType: SizeType;

  /**
   * Display order inside its sizing system. Must be >= 0.
   */
  @Column({ type: 'integer', default: 0 })
  sortOrder: number;

  /**
   * Indicates whether the size is active.
   */
  @Column({ type: 'boolean', default: true })
  isActive: boolean;

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