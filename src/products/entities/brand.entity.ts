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

/**
 * Represents a brand (e.g. Nike, Adidas, Zara).
 *
 * The name column uses the PostgreSQL "citext" type, so the unique
 * constraint on name is case-insensitive ("Nike" and "nike" conflict)
 * while the stored value keeps its original letter case.
 */
@Entity('brands')
@Unique('uq_brands_name', ['name'])
@Unique('uq_brands_slug', ['slug'])
@Index('idx_brands_is_active', ['isActive'])
@Check('chk_brands_slug_format', `"slug" ~ '^[a-z0-9]+(-[a-z0-9]+)*$'`)
@Check('chk_brands_name_not_blank', `length(trim("name")) > 0`)
@Check('chk_brands_name_length', `char_length("name") <= 100`)
export class Brand {
  /**
   * Unique identifier of the brand.
   */
  @PrimaryGeneratedColumn('uuid')
  id: string;

  /**
   * Brand name (maximum 100 characters, enforced by a CHECK constraint).
   * Unique ignoring letter case.
   */
  @Column({ type: 'citext' })
  name: string;

  /**
   * Unique URL slug.
   */
  @Column({ type: 'varchar', length: 120 })
  slug: string;

  /**
   * Optional brand description.
   */
  @Column({ type: 'text', nullable: true })
  description: string | null;

  /**
   * Optional logo URL (https only, validated in DTO).
   */
  @Column({ type: 'varchar', length: 500, nullable: true })
  logoUrl: string | null;

  /**
   * Optional official website URL (https only, validated in DTO).
   */
  @Column({ type: 'varchar', length: 500, nullable: true })
  websiteUrl: string | null;

  /**
   * Indicates whether the brand is active.
   * Disabling a brand never deletes or changes its products.
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