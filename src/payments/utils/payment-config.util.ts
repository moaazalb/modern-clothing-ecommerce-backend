import { ConfigService } from '@nestjs/config';

import { DEFAULT_PAYMENT_WINDOW_MINUTES } from '../constants/payment.constants';

/**
 * Reads PAYMENT_WINDOW_MINUTES: how long a customer has to pay an online
 * order. It must be a whole number between 5 and 1440 (one day).
 *
 * @param configService Provides environment configuration.
 * @returns The payment window in minutes.
 * @throws Error If the configured value is invalid (the app refuses to start).
 */
export function readPaymentWindowMinutes(configService: ConfigService): number {
  const minutes = Number(
    configService.get<string>('PAYMENT_WINDOW_MINUTES') ??
      DEFAULT_PAYMENT_WINDOW_MINUTES,
  );

  if (!Number.isInteger(minutes) || minutes < 5 || minutes > 1440) {
    throw new Error(
      'PAYMENT_WINDOW_MINUTES must be a whole number between 5 and 1440.',
    );
  }

  return minutes;
}