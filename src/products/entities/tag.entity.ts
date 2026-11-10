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
 * Represents a product tag (e.g. New Arrival, Summer Collection).
 *
 * The name column uses the PostgreSQL "citext" type, so uniqueness is
 * case-insensitive. Tags are disabled with isActive = false, never deleted.
 */
@Entity('tags')
@Unique('uq_tags_name', ['name'])
@Unique('uq_tags_slug', ['slug'])
@Index('idx_tags_is_active', ['isActive'])
@Check('chk_tags_slug_format', `"slug" ~ '^[a-z0-9]+(-[a-z0-9]+)*$'`)
@Check('chk_tags_name_not_blank', `length(trim("name")) > 0`)
@Check('chk_tags_name_length', `char_length("name") <= 50`)
export class Tag {
  /**
   * Unique identifier of the tag.
   */
  @PrimaryGeneratedColumn('uuid')
  id: string;

  /**
   * Tag name (maximum 50 characters, enforced by a CHECK constraint).
   * Unique ignoring letter case.
   */
  @Column({ type: 'citext' })
  name: string;

  /**
   * Unique URL slug.
   */
  @Column({ type: 'varchar', length: 70 })
  slug: string;

  /**
   * Indicates whether the tag is active.
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