import {
  CreateDateColumn,
  Column,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  Unique,
  UpdateDateColumn,
} from 'typeorm';

import { User } from '../../users/entities/user.entity';

/**
 * Shopping cart. Each user has at most one cart (unique userId), created
 * the first time an item is added.
 *
 * Deleting a user deletes the cart (temporary data), unlike catalog data.
 */
@Entity('carts')
@Unique('uq_carts_user', ['userId'])
export class Cart {
  /**
   * Unique identifier of the cart.
   */
  @PrimaryGeneratedColumn('uuid')
  id: string;

  /**
   * Identifier of the cart owner.
   */
  @Column({ type: 'uuid' })
  userId: string;

  /**
   * The cart owner.
   */
  @ManyToOne(() => User, {
    nullable: false,
    onDelete: 'CASCADE',
    onUpdate: 'NO ACTION',
  })
  @JoinColumn({ name: 'userId', foreignKeyConstraintName: 'fk_carts_user' })
  user: User;

  /**
   * Date and time when the cart was created.
   */
  @CreateDateColumn({ type: 'timestamptz' })
  createdAt: Date;

  /**
   * Date and time of the last change to the cart.
   */
  @UpdateDateColumn({ type: 'timestamptz' })
  updatedAt: Date;
}