import {
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  NotFoundException,
  Param,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { randomUUID } from 'node:crypto';
import { DataSource } from 'typeorm';

import { MOCK_PROVIDER_NAME } from '../constants/payment.constants';
import { MockPaymentEventQueryDto } from '../dto/mock-payment-event-query.dto';
import { Payment } from '../entities/payment.entity';
import { MockProviderGuard } from '../guards/mock-provider.guard';
import { MockPaymentProvider } from '../providers/mock-payment.provider';
import { PaymentProvider } from '../providers/payment.provider';
import { PaymentWebhookService } from '../services/payment-webhook.service';

/**
 * Development-only endpoints that play the role of the payment gateway
 * page: they send a correctly signed webhook, exactly like a real gateway.
 *
 * They exist only while the mock provider is configured outside
 * production (MockProviderGuard answers 404 otherwise).
 */
@ApiTags('Dev / Mock Payments')
@UseGuards(MockProviderGuard)
@Controller('dev/mock-payments')
export class MockPaymentsController {
  /**
   * Injects what is needed to build and deliver signed webhooks.
   *
   * @param dataSource TypeORM data source.
   * @param provider The configured provider (must be the mock one).
   * @param webhookService Webhook processing.
   */
  constructor(
    private readonly dataSource: DataSource,
    private readonly provider: PaymentProvider,
    private readonly webhookService: PaymentWebhookService,
  ) {}

  /**
   * Finds the payment behind a mock provider id.
   *
   * @param providerPaymentId Mock provider payment id.
   * @returns The payment.
   * @throws NotFoundException If it does not exist.
   */
  private async findPayment(providerPaymentId: string): Promise<Payment> {
    const payment = await this.dataSource.manager.findOne(Payment, {
      where: { provider: MOCK_PROVIDER_NAME, providerPaymentId },
    });

    if (!payment) {
      throw new NotFoundException();
    }

    return payment;
  }

  /**
   * Builds a signed webhook and delivers it to the webhook service.
   *
   * @param type Event type.
   * @param payment The payment the event is about.
   * @param eventId Event id to use (a new one when omitted).
   * @param extra Additional fields of the event.
   * @returns The event id that was delivered.
   */
  private async deliver(
    type: string,
    payment: Payment,
    eventId: string | undefined,
    extra: Record<string, unknown> = {},
  ): Promise<string> {
    if (!(this.provider instanceof MockPaymentProvider)) {
      throw new NotFoundException();
    }

    const id = eventId ?? `evt_${randomUUID()}`;

    const body = JSON.stringify({
      id,
      type,
      paymentId: payment.providerPaymentId,
      reference: payment.id,
      amount: payment.amount,
      currency: payment.currency,
      ...extra,
    });

    const timestamp = Math.floor(Date.now() / 1000);

    await this.webhookService.handle(MOCK_PROVIDER_NAME, Buffer.from(body, 'utf8'), {
      'x-mock-timestamp': String(timestamp),
      'x-mock-signature': this.provider.sign(body, timestamp),
    });

    return id;
  }

  /**
   * Shows the fake payment page data.
   *
   * @param providerPaymentId Mock provider payment id.
   * @returns The payment and how to complete it.
   */
  @Get(':providerPaymentId')
  @ApiOperation({ summary: 'Fake payment page (development only)' })
  async show(@Param('providerPaymentId') providerPaymentId: string) {
    const payment = await this.findPayment(providerPaymentId);

    return {
      amount: payment.amount,
      currency: payment.currency,
      status: payment.status,
      instructions:
        'POST .../succeed to pay, or POST .../fail to simulate a declined card.',
    };
  }

  /**
   * Simulates the customer paying successfully.
   *
   * @param providerPaymentId Mock provider payment id.
   * @param query Optional event id (send the same one twice to simulate a repeated event).
   * @returns The event id that was delivered.
   */
  @Post(':providerPaymentId/succeed')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Simulate a successful payment (development only)',
    description:
      'Sends a signed payment.succeeded webhook. Reusing the same eventId simulates the gateway repeating an event.',
  })
  async succeed(
    @Param('providerPaymentId') providerPaymentId: string,
    @Query() query: MockPaymentEventQueryDto,
  ) {
    const payment = await this.findPayment(providerPaymentId);
    const eventId = await this.deliver('payment.succeeded', payment, query.eventId);

    return { delivered: true, eventId };
  }

  /**
   * Simulates a declined payment.
   *
   * @param providerPaymentId Mock provider payment id.
   * @param query Optional event id.
   * @returns The event id that was delivered.
   */
  @Post(':providerPaymentId/fail')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Simulate a declined payment (development only)' })
  async fail(
    @Param('providerPaymentId') providerPaymentId: string,
    @Query() query: MockPaymentEventQueryDto,
  ) {
    const payment = await this.findPayment(providerPaymentId);
    const eventId = await this.deliver('payment.failed', payment, query.eventId, {
      reason: 'card_declined',
    });

    return { delivered: true, eventId };
  }
}