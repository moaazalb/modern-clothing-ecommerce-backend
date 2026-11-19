import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  Unique,
} from 'typeorm';

import { Payment } from './payment.entity';

/**
 * Inbox of the webhook events received from the provider.
 *
 * The unique (provider, eventId) pair is what makes webhook processing
 * idempotent: an event that was already processed is recognized and
 * ignored. The raw payload is kept for audit and debugging.
 */
@Entity('payment_events')
@Unique('uq_payment_events_provider_event', ['provider', 'eventId'])
@Index('idx_payment_events_provider_payment', ['provider', 'providerPaymentId'])
@Index('idx_payment_events_payment', ['paymentId'])
export class PaymentEvent {
  /**
   * Unique identifier of the stored event.
   */
  @PrimaryGeneratedColumn('uuid')
  id: string;

  /**
   * Provider that sent the event.
   */
  @Column({ type: 'varchar', length: 30 })
  provider: string;

  /**
   * Event identifier given by the provider.
   */
  @Column({ type: 'varchar', length: 100 })
  eventId: string;

  /**
   * Event type (for example payment.succeeded).
   */
  @Column({ type: 'varchar', length: 60 })
  type: string;

  /**
   * Payment identifier at the provider, when the event carries one.
   */
  @Column({ type: 'varchar', length: 100, nullable: true })
  providerPaymentId: string | null;

  /**
   * Identifier of the matching payment, when it was found.
   */
  @Column({ type: 'uuid', nullable: true })
  paymentId: string | null;

  /**
   * The matching payment.
   */
  @ManyToOne(() => Payment, {
    nullable: true,
    onDelete: 'RESTRICT',
    onUpdate: 'NO ACTION',
  })
  @JoinColumn({
    name: 'paymentId',
    foreignKeyConstraintName: 'fk_payment_events_payment',
  })
  payment: Payment | null;

  /**
   * Raw event content as received.
   */
  @Column({ type: 'jsonb' })
  payload: Record<string, unknown>;

  /**
   * What the system did with the event (APPLIED, NOOP, UNKNOWN_PAYMENT,
   * AMOUNT_MISMATCH, LATE_PAYMENT, DUPLICATE_PAYMENT, IGNORED).
   */
  @Column({ type: 'varchar', length: 40 })
  outcome: string;

  /**
   * Date and time when the event was received.
   */
  @CreateDateColumn({ type: 'timestamptz' })
  createdAt: Date;
}