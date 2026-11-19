import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ScheduleModule } from '@nestjs/schedule';
import { TypeOrmModule } from '@nestjs/typeorm';

import { OrdersModule } from '../orders/orders.module';
import { AdminPaymentsController } from './controllers/admin-payments.controller';
import { MockPaymentsController } from './controllers/mock-payments.controller';
import { PaymentWebhooksController } from './controllers/payment-webhooks.controller';
import { PaymentsController } from './controllers/payments.controller';
import { PaymentEvent } from './entities/payment-event.entity';
import { Payment } from './entities/payment.entity';
import { MockProviderGuard } from './guards/mock-provider.guard';
import { createPaymentProvider } from './providers/payment-provider.factory';
import { PaymentProvider } from './providers/payment.provider';
import { AdminPaymentsService } from './services/admin-payments.service';
import { PaymentExpiryService } from './services/payment-expiry.service';
import { PaymentJobsService } from './services/payment-jobs.service';
import { PaymentRefundService } from './services/payment-refund.service';
import { PaymentWebhookService } from './services/payment-webhook.service';
import { PaymentsService } from './services/payments.service';

/**
 * Payments module (online payment).
 *
 * The payment gateway is a replaceable adapter chosen by PAYMENT_PROVIDER
 * (see payment-provider.factory.ts). The module depends on the Orders
 * module (status machine), and the Orders module knows nothing about it.
 * The scheduled jobs expire unpaid orders and return money.
 */
@Module({
  imports: [
    TypeOrmModule.forFeature([Payment, PaymentEvent]),
    OrdersModule,
    ScheduleModule.forRoot(),
  ],
  controllers: [
    AdminPaymentsController,
    MockPaymentsController,
    PaymentWebhooksController,
    PaymentsController,
  ],
  providers: [
    {
      provide: PaymentProvider,
      inject: [ConfigService],
      useFactory: createPaymentProvider,
    },
    AdminPaymentsService,
    MockProviderGuard,
    PaymentExpiryService,
    PaymentJobsService,
    PaymentRefundService,
    PaymentsService,
    PaymentWebhookService,
  ],
})
export class PaymentsModule {}