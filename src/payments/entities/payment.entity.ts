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

import { Order } from '../../orders/entities/order.entity';
import { PaymentAttemptStatus } from '../enums/payment-attempt-status.enum';

/**
 * One online payment attempt of an order.
 *
 * An order can have several attempts (a failed card, then a new try), but
 * the database guarantees at most one PENDING attempt and at most one
 * SUCCEEDED attempt per order. paidAt is set if and only if the money was
 * received (SUCCEEDED, REFUND_PENDING or REFUNDED), and refundedAt if and
 * only if the status is REFUNDED. Payments are never deleted.
 */
@Entity('payments')
@Unique('uq_payments_provider_payment', ['provider', 'providerPaymentId'])
@Index('idx_payments_order', ['orderId'])
@Index('uq_payments_one_pending_per_order', ['orderId'], {
  unique: true,
  where: `"status" = 'PENDING'`,
})
@Index('uq_payments_one_succeeded_per_order', ['orderId'], {
  unique: true,
  where: `"status" = 'SUCCEEDED'`,
})
@Check('chk_payments_amount', `"amount" > 0`)
@Check('chk_payments_currency', `"currency" ~ '^[A-Z]{3}$'`)
@Check(
  'chk_payments_paid_at',
  `("status" IN ('SUCCEEDED', 'REFUND_PENDING', 'REFUNDED')) = ("paidAt" IS NOT NULL)`,
)
@Check(
  'chk_payments_refunded_at',
  `("status" = 'REFUNDED') = ("refundedAt" IS NOT NULL)`,
)
export class Payment {
  /**
   * Unique identifier of the payment attempt. It is also the idempotency
   * key sent to the gateway when the checkout session is created.
   */
  @PrimaryGeneratedColumn('uuid')
  id: string;

  /**
   * Identifier of the order being paid.
   */
  @Column({ type: 'uuid' })
  orderId: string;

  /**
   * The order being paid.
   */
  @ManyToOne(() => Order, {
    nullable: false,
    onDelete: 'RESTRICT',
    onUpdate: 'NO ACTION',
  })
  @JoinColumn({
    name: 'orderId',
    foreignKeyConstraintName: 'fk_payments_order',
  })
  order: Order;

  /**
   * Name of the payment provider that handles this attempt.
   */
  @Column({ type: 'varchar', length: 30 })
  provider: string;

  /**
   * Identifier of the payment at the provider. NULL until the checkout
   * session is created.
   */
  @Column({ type: 'varchar', length: 100, nullable: true })
  providerPaymentId: string | null;

  /**
   * Current state. Uses the PostgreSQL enum type "payment_attempt_status".
   */
  @Column({
    type: 'enum',
    enum: PaymentAttemptStatus,
    enumName: 'payment_attempt_status',
    default: PaymentAttemptStatus.PENDING,
  })
  status: PaymentAttemptStatus;

  /**
   * Amount to charge, as a decimal string (the order total).
   */
  @Column({ type: 'numeric', precision: 14, scale: 2 })
  amount: string;

  /**
   * Currency of the amount (the order currency).
   */
  @Column({ type: 'varchar', length: 3 })
  currency: string;

  /**
   * Address where the customer pays. NULL until the session is created.
   */
  @Column({ type: 'varchar', length: 2000, nullable: true })
  checkoutUrl: string | null;

  /**
   * Last moment the customer can pay (order creation time plus the payment window).
   */
  @Column({ type: 'timestamptz' })
  expiresAt: Date;

  /**
   * When the money was received.
   */
  @Column({ type: 'timestamptz', nullable: true })
  paidAt: Date | null;

  /**
   * Why the attempt failed.
   */
  @Column({ type: 'varchar', length: 300, nullable: true })
  failureReason: string | null;

  /**
   * When the money was returned.
   */
  @Column({ type: 'timestamptz', nullable: true })
  refundedAt: Date | null;

  /**
   * Last error returned by the provider when a refund was attempted.
   */
  @Column({ type: 'varchar', length: 300, nullable: true })
  refundError: string | null;

  /**
   * Date and time when the attempt was created.
   */
  @CreateDateColumn({ type: 'timestamptz' })
  createdAt: Date;

  /**
   * Date and time of the last change to the attempt.
   */
  @UpdateDateColumn({ type: 'timestamptz' })
  updatedAt: Date;
}