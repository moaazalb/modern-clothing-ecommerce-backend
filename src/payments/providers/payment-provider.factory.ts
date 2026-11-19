import { ConfigService } from '@nestjs/config';

import { MOCK_PROVIDER_NAME } from '../constants/payment.constants';
import { MockPaymentProvider } from './mock-payment.provider';
import { PaymentProvider } from './payment.provider';

/**
 * Chooses the payment provider from PAYMENT_PROVIDER.
 *
 * There is no default on purpose: the setting must be explicit, so a
 * server can never run with a test provider by forgetting a variable. The
 * mock provider is refused when NODE_ENV is "production".
 *
 * To add a real gateway: write its adapter (extends PaymentProvider) and
 * add a case here.
 *
 * @param configService Provides environment configuration.
 * @returns The provider instance.
 * @throws Error If PAYMENT_PROVIDER is missing, unknown, or mock in production.
 */
export function createPaymentProvider(
  configService: ConfigService,
): PaymentProvider {
  const name = configService.get<string>('PAYMENT_PROVIDER')?.trim().toLowerCase();

  if (!name) {
    throw new Error(
      'PAYMENT_PROVIDER is required (use "mock" for development).',
    );
  }

  switch (name) {
    case MOCK_PROVIDER_NAME:
      if (configService.get<string>('NODE_ENV') === 'production') {
        throw new Error(
          'The mock payment provider cannot be used when NODE_ENV is production.',
        );
      }

      return new MockPaymentProvider(configService);

    default:
      throw new Error(
        `Unknown PAYMENT_PROVIDER "${name}". Add its adapter in payment-provider.factory.ts.`,
      );
  }
}