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
 * Central dictionary of colors (e.g. Black #000000).
 *
 * The name column uses the PostgreSQL "citext" type, so uniqueness is
 * case-insensitive ("Black" and "BLACK" conflict).
 */
@Entity('colors')
@Unique('uq_colors_name', ['name'])
@Unique('uq_colors_slug', ['slug'])
@Index('idx_colors_is_active', ['isActive'])
@Check('chk_colors_hex_format', `"hexCode" ~ '^#[0-9A-Fa-f]{6}$'`)
@Check('chk_colors_slug_format', `"slug" ~ '^[a-z0-9]+(-[a-z0-9]+)*$'`)
@Check('chk_colors_name_not_blank', `length(trim("name")) > 0`)
@Check('chk_colors_name_length', `char_length("name") <= 50`)
export class Color {
  /**
   * Unique identifier of the color.
   */
  @PrimaryGeneratedColumn('uuid')
  id: string;

  /**
   * Color name (maximum 50 characters, enforced by a CHECK constraint).
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
   * Hex color code in the format #RRGGBB.
   * Normalized to uppercase by the backend before saving.
   */
  @Column({ type: 'varchar', length: 7 })
  hexCode: string;

  /**
   * Indicates whether the color is active.
   * Disabling a color keeps its existing relations intact.
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