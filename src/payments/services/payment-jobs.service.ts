import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Cron, CronExpression } from '@nestjs/schedule';

import { PaymentExpiryService } from './payment-expiry.service';
import { PaymentRefundService } from './payment-refund.service';

/**
 * Scheduled jobs of the payments module.
 *
 * - every minute: cancel online orders that were not paid in time;
 * - every 5 minutes: return the money that must be returned.
 *
 * Both are safe to run on several servers at once (they lock the rows
 * they touch). Set PAYMENT_JOBS_ENABLED=false to switch them off (tests).
 */
@Injectable()
export class PaymentJobsService {
  private readonly logger = new Logger(PaymentJobsService.name);
  private readonly enabled: boolean;
  private expiryRunning = false;
  private refundRunning = false;

  /**
   * Injects the services this class relies on.
   *
   * @param configService Provides PAYMENT_JOBS_ENABLED.
   * @param expiryService Cancels unpaid online orders.
   * @param refundService Returns money.
   */
  constructor(
    configService: ConfigService,
    private readonly expiryService: PaymentExpiryService,
    private readonly refundService: PaymentRefundService,
  ) {
    this.enabled = configService.get<string>('PAYMENT_JOBS_ENABLED') !== 'false';
  }

  /**
   * Cancels unpaid online orders. A run that starts while the previous one
   * is still going is skipped.
   */
  @Cron(CronExpression.EVERY_MINUTE)
  async expireUnpaidOrders(): Promise<void> {
    if (!this.enabled || this.expiryRunning) {
      return;
    }

    this.expiryRunning = true;

    try {
      const cancelled = await this.expiryService.run();

      if (cancelled > 0) {
        this.logger.log(`Cancelled ${cancelled} unpaid online order(s).`);
      }
    } catch (error) {
      this.logger.error(
        'The payment expiry job failed.',
        error instanceof Error ? error.stack : String(error),
      );
    } finally {
      this.expiryRunning = false;
    }
  }

  /**
   * Returns the money that must be returned. A run that starts while the
   * previous one is still going is skipped.
   */
  @Cron(CronExpression.EVERY_5_MINUTES)
  async processRefunds(): Promise<void> {
    if (!this.enabled || this.refundRunning) {
      return;
    }

    this.refundRunning = true;

    try {
      const processed = await this.refundService.processBatch();

      if (processed > 0) {
        this.logger.log(`Processed ${processed} refund(s).`);
      }
    } catch (error) {
      this.logger.error(
        'The refund job failed.',
        error instanceof Error ? error.stack : String(error),
      );
    } finally {
      this.refundRunning = false;
    }
  }
}