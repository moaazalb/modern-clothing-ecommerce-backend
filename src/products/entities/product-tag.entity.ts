import {
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryColumn,
} from 'typeorm';

import { Product } from './product.entity';
import { Tag } from './tag.entity';

/**
 * Join table that links products and tags (many-to-many).
 *
 * It uses a composite primary key (productId, tagId) and has no
 * separate UUID.
 */
@Entity('product_tags')
@Index('idx_product_tags_tag', ['tagId'])
export class ProductTag {
  /**
   * Identifier of the product (part of the composite primary key).
   */
  @PrimaryColumn({ type: 'uuid' })
  productId: string;

  /**
   * Identifier of the tag (part of the composite primary key).
   */
  @PrimaryColumn({ type: 'uuid' })
  tagId: string;

  /**
   * The tagged product.
   */
  @ManyToOne(() => Product, {
    nullable: false,
    onDelete: 'RESTRICT',
    onUpdate: 'NO ACTION',
  })
  @JoinColumn({
    name: 'productId',
    foreignKeyConstraintName: 'fk_product_tags_product',
  })
  product: Product;

  /**
   * The tag linked to the product.
   */
  @ManyToOne(() => Tag, {
    nullable: false,
    onDelete: 'RESTRICT',
    onUpdate: 'NO ACTION',
  })
  @JoinColumn({
    name: 'tagId',
    foreignKeyConstraintName: 'fk_product_tags_tag',
  })
  tag: Tag;

  /**
   * Date and time when the link was created.
   */
  @CreateDateColumn({ type: 'timestamptz' })
  createdAt: Date;
}